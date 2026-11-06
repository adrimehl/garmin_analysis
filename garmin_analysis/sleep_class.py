# -*- coding: utf-8 -*-
"""
Created on Fri Jun 30 18:36:12 2023

@author: ADRIMEHL
"""
import os
import glob
import seaborn as sns
import json
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.ticker as tkr
import matplotlib.pyplot as plt
import numpy as np
import plotly.express as px 
import plotly.io as pio
import calmap
sns.set_style("darkgrid")


class Sleep: 
    
    def __init__(self, filepath, savepath):
        self.savepath = savepath
        #get all JSON sleep files and append all values to one list
        data = []
        file_list = sorted(glob.glob(os.path.join(filepath, "*_sleepData.json")))
        if not file_list:
            raise FileNotFoundError(f"No '*_sleepData.json' files found in '{filepath}'")
        for i in file_list:
            with open(i, 'r', encoding='utf-8') as f:
                data.extend(json.load(f))

        # one row per night (DataFrame.append was removed in pandas 2.0)
        self.sleep_df = pd.DataFrame(data)
        # nights without start/end timestamps (e.g. watch not worn) cannot be analysed
        self.sleep_df = self.sleep_df.dropna(subset=["sleepStartTimestampGMT", "sleepEndTimestampGMT"])
        self.sleep_df = self.sleep_df.drop_duplicates(subset="calendarDate", keep="last")

        self.sleep_df['calendarDate'] = pd.to_datetime(self.sleep_df['calendarDate'])
        self.sleep_df = self.sleep_df.sort_values('calendarDate')
        self.sleep_df['weekday'] = self.sleep_df['calendarDate'].dt.day_name()
        self.sleep_df['day_type'] = self.sleep_df['weekday'].isin(['Saturday', 'Sunday']).map({True: 'Weekend', False: 'Regular day'})

        self.sleep_df["start_date"] = pd.to_datetime(self.sleep_df["sleepStartTimestampGMT"])
        self.sleep_df["end_date"] = pd.to_datetime(self.sleep_df["sleepEndTimestampGMT"])
        self.sleep_df["start_time"] = self.sleep_df["start_date"].dt.time
        self.sleep_df["end_time"] = self.sleep_df["end_date"].dt.time
        self.sleep_df['duration'] = (self.sleep_df['end_date'] - self.sleep_df['start_date']).dt.total_seconds() / 3600
        self.sleep_df['week_number'] = self.sleep_df['calendarDate'].dt.isocalendar().week
        # older/partial nights have no sleepScores entry
        if 'sleepScores' in self.sleep_df.columns:
            self.sleep_df['overallScore'] = self.sleep_df['sleepScores'].apply(
                lambda x: x.get('overallScore') if isinstance(x, dict) else np.nan)
        # numeric columns that are missing on some nights stay NaN (not 0), so they
        # show as "no data" in the calendar plots instead of pulling averages down
        for col in ['avgSleepStress', 'restlessMomentCount', 'awakeCount']:
            if col in self.sleep_df.columns:
                self.sleep_df[col] = pd.to_numeric(self.sleep_df[col], errors='coerce')
        self.sleep_df.index = self.sleep_df['calendarDate']
        
        
    def sleep_duration(self):
        # Plot every night on one shared "evening -> morning" axis: times before
        # 14:00 belong to the morning after, so they are moved one day later.
        df = self.sleep_df[["start_time", "end_time", "duration", "day_type", "calendarDate"]].copy()
        today = datetime.now().date()
        noon = datetime.strptime('14:00:00', '%H:%M:%S').time()

        starts, ends = [], []
        for start_time, end_time in zip(df['start_time'], df['end_time']):
            start_date = today + timedelta(days=1) if start_time < noon else today
            end_date = start_date + timedelta(days=1) if end_time < start_time else start_date
            starts.append(datetime.combine(start_date, start_time))
            ends.append(datetime.combine(end_date, end_time))
        df['start_time'] = starts
        df['end_time'] = ends

        fig = px.timeline(df, x_start="start_time", x_end="end_time", y="calendarDate", color="day_type", width=800, height=1000)
        fig.update_yaxes(autorange="reversed") # otherwise tasks are listed from the bottom up
        pio.write_html(fig, os.path.join(self.savepath,'sleep_timeline.html'))
        
        
    def calendarplots(self, columnname, minimum=None, maximum=None):
        
        startyear = self.sleep_df['calendarDate'].dt.year.min()
        endyear = self.sleep_df['calendarDate'].dt.year.max()
        numberrows=(endyear-startyear+1)//2 + 1
        
        df = self.sleep_df[columnname].astype(float).to_frame()
        df[columnname] = df[columnname].clip(lower=minimum, upper=maximum)

        fig = plt.figure(num=None, figsize=(26,numberrows*1.6), dpi=80, facecolor='w', edgecolor='k')


        d={}
        for x in range(0,endyear-startyear+1):
            if x<=(endyear-startyear+1)/2 and (endyear-startyear+1)%2!=0:
                s=x
                f=0
            elif x>(endyear-startyear+1)/2 and (endyear-startyear+1)%2!=0:
                s=(x-(endyear-startyear+1)/2)
                f=4        
            elif x<(endyear-startyear+1)/2 and (endyear-startyear+1)%2==0:
                s=x
                f=0
            elif x>=(endyear-startyear+1)/2 and (endyear-startyear+1)%2==0:
                s=(x-(endyear-startyear+1)/2)
                f=4  
            s=int(s)              
            d["ax{0}".format(x)] = plt.subplot2grid((numberrows, 9), (int(s), f),colspan=4,rowspan=1)  

        if (endyear-startyear)<7:
            cbar_ax = fig.add_axes([0.9, 0.3, 0.01, 0.7])
        else:
            cbar_ax = fig.add_axes([0.9, 0.15, 0.01, 0.7])


        for x in range(0,endyear-startyear+1):
            d["ax{0}".format(x)].tick_params(axis='both', which='major', labelsize=14)



        for x in range(0,endyear-startyear+1):
            cax = calmap.yearplot(df[columnname],year = startyear+x,
                                         vmin=df[columnname].min(), vmax=df[columnname].max(),
                                         daylabels=['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
                                         monthticks=1,
                                         linecolor='w',
                                         monthlabels=['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
                                         fillcolor='grey',cmap='rainbow', ax=d["ax{0}".format(x)])


        ##### format ticks colorbar
        def func(x, pos):  # formatter function takes tick label and tick position
            s = '%d' % x
            groups = []
            while s and s[-1].isdigit():
                groups.append(s[-3:])
                s = s[:-3]
            return s + "'".join(reversed(groups))

        y_format = tkr.FuncFormatter(func)  # make formatter


        fig.colorbar(cax.get_children()[1], cax=cbar_ax,format=y_format)
        #fig.colorbar(cax.get_children()[3], format='%.0e')

        #plt.tight_layout()

        for x in range(0,endyear-startyear+1):
            d["ax{0}".format(x)].text(-1.5, 4,str(startyear+x),fontsize = 14,
                 rotation=90)


        plt.title(columnname, fontsize =16)

        fig.savefig(os.path.join(self.savepath,"Sleepscore_" + columnname + ".pdf"), bbox_inches='tight')
        plt.close(fig)
        
        

    





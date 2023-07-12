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
        file_list = glob.glob(filepath + "/*_sleepData.json")
        for i in file_list:
            with open (i, 'r') as f:
                data.extend(json.load(f))
        
        
        # Create an empty DataFrame to store the extracted data
        self.sleep_df = pd.DataFrame()
        
        # Loop over each dictionary in the list
        for sleep_dict in data:
            # Create a pandas Series from the dictionary and add it to the DataFrame
            sleep_series = pd.Series(sleep_dict)
            self.sleep_df = self.sleep_df.append(sleep_series, ignore_index=True)
        
        # Print the resulting DataFrame
        self.sleep_df=self.sleep_df.fillna(0)
        self.sleep_df['calendarDate'] = pd.to_datetime(self.sleep_df['calendarDate'])
        self.sleep_df['weekday'] = self.sleep_df['calendarDate'].dt.day_name()
        def is_weekend(day):
            if day in ['Saturday', 'Sunday']:
                return 'Weekend'
            else:
                return 'Regular day'
        
        # Apply the function to the day column and create a new column called 'day_type'
        self.sleep_df['day_type'] = self.sleep_df['weekday'].apply(is_weekend)
        self.sleep_df
        
        self.sleep_df["start_date"] = pd.to_datetime(self.sleep_df["sleepStartTimestampGMT"])
        self.sleep_df["end_date"] = pd.to_datetime(self.sleep_df["sleepEndTimestampGMT"])
        self.sleep_df["start_time"] = self.sleep_df["start_date"].dt.time
        self.sleep_df["end_time"] = self.sleep_df["end_date"].dt.time
        self.sleep_df['duration'] = (self.sleep_df['end_date'] - self.sleep_df['start_date']).dt.total_seconds() / 3600
        self.sleep_df['week_number'] = self.sleep_df['calendarDate'].dt.isocalendar().week
        self.sleep_df['overallScore'] = self.sleep_df['sleepScores'].apply(lambda x: x['overallScore'])  
        self.sleep_df.index = self.sleep_df['calendarDate']
        
        
    def sleep_duration(self):
        df = self.sleep_df[["start_time","end_time","duration","day_type","calendarDate"]]
        df["Day"] = df.index
        today = datetime.now().date()
        
        for index, row in df.iterrows():
            start_time = row['start_time']
            end_time = row['end_time']
            if start_time < datetime.strptime('14:00:00', '%H:%M:%S').time():
                start_date = today + timedelta(days=1)
            else:
                start_date = today
        
            if end_time < start_time:
                end_date = start_date + timedelta(days=1)
            else:
                end_date = start_date
        
            start_datetime = datetime.combine(start_date, start_time)
            end_datetime = datetime.combine(end_date, end_time)
        
        
            df.at[index, 'start_time'] = start_datetime
            df.at[index, 'end_time'] = end_datetime
            

        fig = px.timeline(df, x_start="start_time", x_end="end_time", y="calendarDate", color="day_type", width=800, height=1000)
        fig.update_yaxes(autorange="reversed") # otherwise tasks are listed from the bottom up
        pio.write_html(fig, os.path.join(self.savepath,'sleep_timeline.html'))
        
        
    def calendarplots(self, columnname, minimum=None, maximum=None):
        
        startyear = self.sleep_df['calendarDate'].dt.year.min()
        endyear = self.sleep_df['calendarDate'].dt.year.max()
        numberrows=(endyear-startyear+1)//2 + 1
        
        df = self.sleep_df[columnname].to_frame()
        if minimum is not None:
            df[columnname] = df[columnname].apply(lambda x: minimum if x < minimum else x)
        if maximum is not None:
            df[columnname] = df[columnname].apply(lambda x: maximum if x > maximum else x)

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
        
        

    





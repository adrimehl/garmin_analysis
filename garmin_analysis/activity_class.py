# -*- coding: utf-8 -*-
"""
Created on Fri Jun 30 19:44:06 2023

@author: ADRIMEHL
"""
import os
import seaborn as sns
import json
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.ticker as tkr
import matplotlib.pyplot as plt
import numpy as np
import plotly.express as px 
import calmap
sns.set_style("darkgrid")


class Activity:
    
    def __init__(self, filepath, savepath):
        self.data = pd.read_csv(filepath)
        self.savepath = savepath
        
        #convert/adapt columns
        self.data['Activity Type'] = self.data['Activity Type'].str.replace('Resort Skiing/Snowboarding','Resort Skiing')
        self.data['Start Time'] = self.data['Date']
        self.data['Start Time'] = pd.to_datetime(self.data['Start Time'], utc=True)
        self.data.index = self.data['Date'].apply(lambda x: pd.to_datetime(x).replace(hour=0, minute=0, second=0))

        self.data['Elapsed Time'] = self.data['Elapsed Time'].str[:8]
        self.data['Elapsed Time'] = pd.to_timedelta(self.data["Elapsed Time"])
        #self.data['MinutesDuration'] = self.data['Elapsed Time'].dt.hour*60 + self.data['Elapsed Time'].dt.minute
        self.data['MinutesDuration'] = self.data['Elapsed Time'].dt.total_seconds() / 60
        self.data['End Time'] = pd.to_datetime(self.data['Start Time'] + self.data['Elapsed Time'], utc=True)
        self.data['weekday'] = self.data['Start Time'].dt.day_name()
        self.data['Calories'] = pd.to_numeric(self.data['Calories'].str.replace(',',''), errors='coerce')
        self.data['Distance'] = pd.to_numeric(self.data['Distance'], errors='coerce')
        self.data['Total Ascent'] = pd.to_numeric(self.data['Total Ascent'].str.replace(',',''), errors='coerce')
        

        #get total number of weekdays
        self.num_weeks = (self.data['Start Time'].max() - self.data['Start Time'].min()).days // 7

        #print summaray of data
        start=self.data["Start Time"].min()
        end = self.data["Start Time"].max()
        self.total_days = (end - start).days 
        print('Total days analysed: ' + str(self.total_days))
        self.total_weeks= self.total_days/7
        print('Total weeks analysed: ' + str(self.total_weeks))
        self.total_activities = len(self.data)
        print('Total activities: ' + str(self.total_activities))
        print('activities per week: ' + str(self.total_activities/self.total_weeks))
  
    def number_activities_by_weekday(self):
    
        self.data["weekday"] = pd.Categorical(self.data["weekday"], categories=
            ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday', 'Sunday'],
            ordered=True)
        
        weekday_counts = self.data["weekday"].value_counts()/self.num_weeks
        self.weekday_counts = weekday_counts.sort_index()
        plt.figure(figsize=(8, 5), dpi=300)
        plt.bar(weekday_counts.index, weekday_counts.values)
        plt.title("Number of Activities by Weekday")
        plt.xlabel("Weekday")
        plt.ylabel("Count")
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'number_activities_by_weekday.png'))
        plt.close()
    
    def heatmaps(self):
        self.data_heat = self.data.sort_values(by='Start Time')
        start_date = self.data_heat["Start Time"].iloc[0]
        end_date = self.data_heat["End Time"].iloc[-1]
        self.data_heat["date"] = self.data_heat["Start Time"].dt.date
        self.data_heat = self.data_heat.set_index("date")
        
        date_index = pd.date_range(start=start_date, end=end_date)
        df_date = pd.DataFrame({'date': date_index})
        df_date["date"] = df_date["date"]
        
        df_date['week_number'] = df_date['date'].dt.isocalendar().week
        df_date['weekday'] = df_date['date'].dt.day_name()
        df_date["date"] = df_date["date"].dt.date
        df_date = df_date.set_index("date")
        self.data_heat=self.data_heat.drop(["weekday"], axis =1 )
        self.data_heat = df_date.join(self.data_heat)
        
        heat_df = self.data_heat[["week_number","Max HR","weekday"]]
        # Convert the weekday column to a categorical variable with a specific order
        weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        heat_df["weekday"] = pd.Categorical(heat_df["weekday"], categories=weekday_order)
        heat_df["date2"] = heat_df.index
        heat_df = heat_df[~heat_df["date2"].duplicated()]
        heat_df = heat_df.drop(["date2"], axis =1)
        heat_data = heat_df.pivot("week_number", "weekday",  "Max HR")
        
        fig, ax = plt.subplots(figsize=(10, 6))
        sns.heatmap(heat_data, cmap="YlGnBu", annot=True, fmt=".0f", cbar=False, ax=ax)
        ax.set_ylabel("Week nr")
        ax.set_xlabel("Weekday")
        ax.set_title("Max HR")
        
        plt.savefig(os.path.join(self.savepath, 'max_hr_heatmap.png'))
        plt.close()
    
    
        heat_df = self.data_heat[["week_number","Calories","weekday"]]
        # Convert the weekday column to a categorical variable with a specific order
        weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        heat_df["weekday"] = pd.Categorical(heat_df["weekday"], categories=weekday_order)
        heat_df["date2"] = heat_df.index
        heat_df = heat_df[~heat_df["date2"].duplicated()]
        heat_df = heat_df.drop(["date2"], axis =1)
        heat_data = heat_df.pivot("week_number", "weekday",  "Calories")
        
        fig, ax = plt.subplots(figsize=(10, 6))
        sns.heatmap(heat_data, cmap="YlGnBu", annot=True, fmt=".0f", cbar=False, ax=ax)
        
        ax.set_ylabel("Week nr")
        ax.set_xlabel("Weekday")
        ax.set_title("Calories")
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'calories_heatmap.png'))
        plt.close()
        
    def calendarplots(self, columnname):
        
        startyear = self.data.index.year.min()
        endyear = self.data.index.year.max()
        numberrows=(endyear-startyear+1)//2 + 1

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
            cax = calmap.yearplot(self.data[columnname],year = startyear+x,
                                         vmin=self.data[columnname].min(), vmax=self.data[columnname].max(),
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


        #cbar_ax.text(-1.3, 1.1,'Volllastzeit',fontsize = 16)
        #cbar_ax.text(0,1.05,r'$\mathrm{(h)}$',fontsize = 16)

        plt.title(columnname, fontsize =16)

        fig.savefig(os.path.join(self.savepath,"Activity_" + columnname + ".png"), bbox_inches='tight')
        
        

    
    
    def activity_types_pie_chart(self):
        # get activity counts
        activities = self.data["Activity Type"].value_counts()
        
        # set color palette
        colors = ['#5DA5DA', '#FAA43A', '#60BD68', '#F17CB0', '#B2912F', '#B276B2', '#DECF3F', '#F15854']
        sns.set_palette(sns.color_palette(colors))
        
        # plot pie chart
        plt.figure(figsize=(8, 8), dpi=300)
        plt.pie(activities.values, labels=activities.index, autopct='%1.1f%%',textprops={'fontsize': 10})
        plt.title('Activity Types')
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'activity_types_pie.png'))
        plt.close()
        
       
    def duration_of_activities(self):
        
        data_time = self.data.groupby("Activity Type")["MinutesDuration"].sum()
        plt.figure(figsize=(8, 5), dpi=300)
        plt.bar(data_time.index, data_time.values)
        plt.xlabel('Activity Type')
        plt.ylabel('Total Duration (Minutes)')
        plt.title('Total Duration of Each Activity')
        plt.xticks(rotation=90)
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'duration_activities.png'))
        plt.close()
    
    def duration_of_activities_detailed(self):
        # Create subplots with more spacing
        fig, (ax1, ax2) = plt.subplots(ncols=2, figsize=(10,5))
        plt.subplots_adjust(wspace=0.5)
        
        # First subplot
        sns.barplot(x="Activity Type", y="MinutesDuration", data=self.data, estimator=np.mean, ax=ax1)
        ax1.set_xlabel('Activity Type')
        ax1.set_ylabel('Average Duration (Minutes)')
        ax1.set_title('Average Duration (Minutes) of Each Activity')
        ax1.set_xticklabels(labels=ax1.get_xticklabels(), rotation=90)
        
        # Second subplot
        sns.barplot(x="Activity Type", y="MinutesDuration", data=self.data, ci=None, estimator=np.sum, ax=ax2)
        ax2.set_xlabel('Activity Type')
        ax2.set_ylabel('Total Duration (Minutes)')
        ax2.set_title('Total Duration (Minutes) of Each Activity')
        ax2.set_xticklabels(labels=ax2.get_xticklabels(), rotation=90)
        
        # Display the plot
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'duration_activities_detailed.png'))
        plt.close()
    
    def distance_of_activities(self):
        # Create subplots with more spacing
        fig, (ax1, ax2) = plt.subplots(ncols=2, figsize=(10,5))
        plt.subplots_adjust(wspace=0.5)
        
        # First subplot
        sns.barplot(x="Activity Type", y="Distance", data=self.data, estimator=np.mean, ax=ax1)
        ax1.set_xlabel('Activity Type')
        ax1.set_ylabel('Average Distance')
        ax1.set_title('Average Distance of Each Activity')
        ax1.set_xticklabels(labels=ax1.get_xticklabels(), rotation=90)
        
        # Second subplot
        sns.barplot(x="Activity Type", y="Distance", data=self.data, estimator=np.sum, ci=None, ax=ax2)
        ax2.set_xlabel('Activity Type')
        ax2.set_ylabel('Total Distance')
        ax2.set_title('Total Distance of Each Activity')
        ax2.set_xticklabels(labels=ax2.get_xticklabels(), rotation=90)
        
        # Display the plot
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'distance_activities.png'))
        plt.close()
    
    def speed_vs_distance(self):
        df_bcs = self.data[(self.data["Activity Type"].str.contains('cycling', case=False, na=False)) | (self.data["Activity Type"] == "Mountain Biking")]
        df_bcs['Avg Speed'] = df_bcs['Avg Speed'].astype(float)
        
        #plot avg speed vs distance
        plt.figure(figsize=(8, 5), dpi=300)
        sns.scatterplot(data=df_bcs, x="Distance", y="Avg Speed", hue="Activity Type")
        plt.title("Scatter Plot of Speed vs Distance")
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'Speed_vs_Distance.png'))
        plt.close()
        
    def ascent_vs_distance(self):
        #plot distance vs elevation
        df_bcs = self.data[(self.data["Activity Type"].str.contains('cycling', case=False, na=False)) | (self.data["Activity Type"] == "Mountain Biking")]
        
        plt.figure(figsize=(8, 5), dpi=300)
        sns.scatterplot(data=df_bcs, x="Distance", y="Total Ascent", hue="Activity Type")
        plt.title("Scatter Plot of Ascent vs Distance")
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'Ascent_vs_distance.png'))
        plt.close()
    
    def elevation_gain(self):
        df_bcs = self.data[(self.data["Activity Type"].str.contains('cycling', case=False, na=False)) | (self.data["Activity Type"] == "Mountain Biking")]
    
        df_bcs = df_bcs.dropna(subset=['Total Ascent']) # Remove rows with NaN in 'Total Ascent' column
        
        ax = sns.barplot(x=df_bcs.index, y='Total Ascent', data=df_bcs)
        ax.set_title("Elevation Gain for cycling activities")
        ax.legend(loc='center left', bbox_to_anchor=(1, 0.5)) # Move legend outside plot
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'elevation_gain.png'))
        plt.close()
    
    def heart_rate(self):
        # create figure and subplots
        fig, axs = plt.subplots(1, 2, figsize=(12, 6))
        #ax1 = sns.scatterplot(self.data=self.data, y="Avg HR", x="MinutesDuration", hue="Activity Type")
        # plot first scatterplot on first subplot
        sns.scatterplot(data=self.data, y="Avg HR", x="MinutesDuration", hue="Activity Type", ax=axs[0], legend=False)
        axs[0].set_title("Average Heart Rate vs. Duration")
        
        # plot second scatterplot on second subplot
        sns.scatterplot(data=self.data, y="Max HR", x="MinutesDuration", hue="Activity Type", ax=axs[1], legend=False)
        axs[1].set_title("Max. Heart Rate vs. Duration")
        
        # add common legend below subplots
        handles, labels = axs[1].get_legend_handles_labels()
        fig.legend(handles, labels, loc='lower center', ncol=4)
        fig.subplots_adjust(bottom=0.25)
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'heart_rate.png'))
        plt.close()
    
    
    def calories(self):
    
        # create figure and subplots
        fig, axs = plt.subplots(1, 2, figsize=(12, 6))
        
        # plot first boxplot on first subplot
        sns.boxplot(data=self.data, x='Activity Type', y='Calories', ax=axs[0])
        axs[0].set_title('Calories by Activity Type')
        axs[0].set_xlabel('Activity Type')
        axs[0].set_ylabel('Calories')
        axs[0].tick_params(axis='x', rotation=90)
        
        # plot second scatterplot on second subplot
        sns.scatterplot(data=self.data, x="Calories", y="MinutesDuration", hue="Activity Type", ax=axs[1])
        axs[1].set_title("Training duration vs Calories")
        axs[1].set_xlabel('Calories')
        axs[1].set_ylabel('Duration')
        axs[1].legend(loc='upper right')
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'calories.png'))
        plt.close()
    
    def activities_by_hour_of_day(self):
        self.data["start_hour"] = self.data["Start Time"].dt.time
        self.data['hour'] = self.data['Start Time'].dt.hour
        active_hours = self.data[["hour","Activity Type"]]
        
        hours = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
        active_hours = active_hours.groupby(['hour', 'Activity Type']).size().unstack()
        active_hours = active_hours.reindex(hours, fill_value=np.nan)
        
        plt.figure(figsize=(8, 5), dpi=300)
        #plt.bar(active_hours.index, active_hours.values, stacked=True)
        active_hours.plot(kind='bar', stacked=True)
        plt.xlabel('Hour of Day')
        plt.ylabel('Number of Activities')
        plt.title('Activity Types by Hour of Day')
        plt.legend(title='Activity Type', loc='upper left')
        plt.tight_layout()
        plt.savefig(os.path.join(self.savepath, 'activities_by_hour.png'))
        plt.close()

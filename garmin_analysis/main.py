# -*- coding: utf-8 -*-
"""
Created on Sun Jul  2 12:19:08 2023

@author: ADRIMEHL
"""
import os
import matplotlib
matplotlib.use("Agg")  # write plots to files, no window needed
import activity_class as activity
import sleep_class as sleep


#add inputs (os.path.join works on Windows, macOS and Linux)
filepath_activity = os.path.join('data', 'Activities.csv')                     #path to activity csv-file
folder_sleep = os.path.join('data', 'DI_CONNECT', 'DI-Connect-Wellness')       #path to wellness json-folder

#outputs
savepath = 'plots'


def check_and_create_folder(folder_path):
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        print(f"Folder '{folder_path}' created.")
    else:
        print(f"Folder '{folder_path}' already exists.")
        
        
if __name__ == "__main__":
    
    #check and create save folder
    check_and_create_folder(savepath)

    #%% analyse activities

    a = activity.Activity(filepath_activity, savepath)

    a.number_activities_by_weekday()
    a.heatmaps()
    a.activity_types_pie_chart()
    a.duration_of_activities()
    a.duration_of_activities_detailed()
    a.distance_of_activities()
    a.speed_vs_distance()
    a.ascent_vs_distance()
    a.elevation_gain()
    a.heart_rate()
    a.calories()
    a.activities_by_hour_of_day()
    
    a.calendarplots('Distance')
    a.calendarplots('Calories')
    a.calendarplots('Max HR')
    a.calendarplots('MinutesDuration')
    
    #%% analyse sleep
    s = sleep.Sleep(folder_sleep, savepath)
    
    s.sleep_duration()
    s.calendarplots('duration')
    s.calendarplots('avgSleepStress',10,35)
    s.calendarplots('restlessMomentCount')
    
    
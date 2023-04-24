@echo off
REM @call genoas http://oemobiledemo.progress.com/OEMobileDemoServices/static/CustomerService.json
REM @call genoas http://oemobiledemo.progress.com/OEMobileDemoServices/static/SportsService.json
REM @call genoas samples/CustomerService.json
REM @call genoas http://oemobiledemo.progress.com/OEMobileDemoServices/static/SportsService.json --target 2.0

REM @call genoas --format json samples/CustomerService.json
REM @call genoas http://oemobiledemo.progress.com/OEMobileDemoServices/static/CustomerService.json --target 3.0.0
REM @call genoas http://oemobiledemo.progress.com/OEMobileDemoServices/static/CustomerService.json --target 2.0
REM @call genoas https://oemobiledemo.progress.com/OEMobileDemoServices/static/CustomerService.json --target 2.0

REM @call genoas http://oemobiledemo.progress.com/OEMobileDemoServices/static/SportsService.json --target 2.0
REM @call genoas --format json --target 2.0 samples/CustomerService.json

REM @call genoas --target 2.0 samples/CustomerService.json --host http://oemobiledemo.progress.com/OEMobileDemoServices

@call genoas --target 2.0 samples/SportsService.json --host http://oemobiledemo.progress.com/OEMobileDemoServices
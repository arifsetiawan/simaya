#!/bin/sh

APPPATH=~/apps/simaya

if [ ! -f ~/apps/simaya/ob ] || [ ! -f ~/apps/simaya/sinergis ]
then
    echo "Creating symlink..."
    ln -s ~/apps/simaya/ownbox/models ~/apps/simaya/ob
    ln -s ~/apps/simaya/sinergis-base/sinergis ~/apps/simaya/sinergis
else
    echo "Symlink exist. Skipping..."
fi

# Get index of simaya app in forever process list
if [ $(forever list | grep simaya/app.js | awk '{print $2}' | cut -c2) ]
then
    echo "Simaya is running. Restart"
    forever restart $(forever list | grep simaya/app.js | awk '{print $2}' | cut -c2)
    echo "Port: ${PORT}. Setting: ${SIMAYASETTING}."
else
    echo "Running Simaya."
    export PORT=3000
    export DBHOST=localhost
    export DB=simaya
    export SIMAYASETTING=settings.prod.js
    forever start ~/apps/simaya/app.js > /dev/null
    echo "Port: ${PORT}. Setting: ${SIMAYASETTING}."
fi

#!/bin/sh

# Initialize PocketBase with schema if database doesn't exist
if [ ! -f "/app/pb_data/data.db" ]; then
    echo "Initializing PocketBase database..."
    
    # Import schema
    if [ -f "/app/pb_schema.json" ]; then
        echo "Importing database schema..."
        ./pocketbase migrate --dir=/app/pb_data
        ./pocketbase migrate --dir=/app/pb_data up
    fi
fi

# Start PocketBase
echo "Starting PocketBase server..."
./pocketbase serve --http=0.0.0.0:8080 --dir=/app/pb_data
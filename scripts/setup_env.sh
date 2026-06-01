#!/bin/bash

# Setup backend .env
if [ ! -f backend/.env ]; then
    echo "Creating backend/.env from .env.example"
    cp backend/.env.example backend/.env
else
    echo "backend/.env already exists"
fi

# Setup frontend .env
if [ ! -f frontend/.env ]; then
    echo "Creating frontend/.env from .env.example"
    cp frontend/.env.example frontend/.env
else
    echo "frontend/.env already exists"
fi

echo "Environment setup complete."

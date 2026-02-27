#!/bin/bash

# 1. Saari files ko add karein
git add .

# 2. User se commit message maangein
echo "Enter your commit message:"
read message

# 3. Commit karein
git commit -m "$message"

# 4. GitHub par push karein
git push origin main

echo "------------------------------"
echo "✅ GitHub updated successfully!"
echo "------------------------------"
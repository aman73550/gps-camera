#!/bin/bash
# 1. Files add karein
git add .

# 2. Bina pucha "latest update" message ke saath commit karein
git commit -m "latest update"

# 3. GitHub par push karein
git push origin main

echo "------------------------------"
echo "✅ GitHub updated successfully!"
echo "------------------------------"
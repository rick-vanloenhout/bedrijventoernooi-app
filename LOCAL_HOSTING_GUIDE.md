# Local Hosting Guide for Tournament Application

## Quick Start (Local Network)

### Step 1: Start the Server

**Windows:**
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Mac/Linux:**
```bash
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

The `--host 0.0.0.0` flag allows other devices on your network to connect.

### Step 2: Find Your IP Address

**Windows:**
1. Open Command Prompt
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your WiFi adapter
4. Example: `192.168.1.100`

**Mac:**
1. Open Terminal
2. Type: `ifconfig | grep "inet "`
3. Look for IP starting with `192.168.` or `10.`
4. Example: `192.168.1.100`

**Linux:**
1. Open Terminal
2. Type: `ip addr show` or `hostname -I`
3. Look for IP starting with `192.168.` or `10.`

### Step 3: Share the URL

Share this URL with players:
```
http://YOUR_IP:8000/frontend/index.html
```

Example:
```
http://192.168.1.100:8000/frontend/index.html
```

### Step 4: Access from Other Devices

Players can:
1. Connect to the same WiFi network
2. Open a web browser on their phone/tablet
3. Navigate to the URL you shared
4. View schedules and standings (no login required)

---

## Troubleshooting

### Can't connect from other devices?

1. **Check firewall**: Windows Firewall might block port 8000
   - Solution: Allow Python through firewall or temporarily disable firewall
   
2. **Check WiFi**: Make sure all devices are on the same network

3. **Check IP address**: Your IP might change if you reconnect to WiFi
   - Solution: Check IP again and update the URL

4. **Port already in use**: Another app might be using port 8000
   - Solution: Use a different port: `--port 8001`

### Make it easier: Create a startup script

**Windows (`start-server.bat`):**
```batch
@echo off
echo Starting Tournament Server...
echo.
echo Finding your IP address...
ipconfig | findstr /i "IPv4"
echo.
echo Server starting on http://0.0.0.0:8000
echo Share this URL with players: http://YOUR_IP:8000/frontend/index.html
echo.
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
```

**Mac/Linux (`start-server.sh`):**
```bash
#!/bin/bash
echo "Starting Tournament Server..."
echo ""
echo "Your IP address:"
ifconfig | grep "inet " | grep -v 127.0.0.1
echo ""
echo "Server starting on http://0.0.0.0:8000"
echo "Share this URL with players: http://YOUR_IP:8000/frontend/index.html"
echo ""
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

---

## Security Tips

1. **Use strong admin password**: Don't use default credentials
2. **Keep server running**: Only during tournament hours
3. **Close server**: Stop the server when tournament ends
4. **WiFi password**: Use a password-protected WiFi network

---

## Cloud Hosting Alternative

If you want cloud access (works from anywhere), see `CLOUD_HOSTING_GUIDE.md` (if created) or consider:

- **Render.com**: Free tier, easy deployment
- **Railway.app**: $5/month credit, simple setup
- **Fly.io**: Free tier available

---

## Tips for Tournament Day

1. **Test beforehand**: Start server and test from a phone before tournament
2. **Write down IP**: Have the IP address written down for easy sharing
3. **QR Code**: Create a QR code with the URL for easy access
4. **Backup plan**: Have a printed schedule as backup
5. **Battery**: Keep laptop plugged in or have a charger

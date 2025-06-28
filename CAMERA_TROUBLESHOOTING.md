# 📷 Camera Access Troubleshooting Guide

## 🚨 **"Camera Access Denied" Error Solutions**

### **Windows 10/11 System Permissions**

1. **Check Windows Camera Privacy Settings**
   ```
   Settings > Privacy & Security > Camera
   ```
   - Ensure "Allow apps to access your camera" is **ON**
   - Ensure "Allow desktop apps to access your camera" is **ON**

2. **Check Device Manager**
   ```
   Right-click Start > Device Manager > Cameras
   ```
   - Ensure your camera device is listed and enabled
   - If you see a yellow warning icon, update the driver

### **Browser/Electron Specific**

3. **Clear Browser Data** (if testing in browser first)
   - Clear cache, cookies, and site data
   - Try in an incognito/private window

4. **Restart the Application**
   - Close Court Assistant completely
   - Restart the application
   - Allow camera access when prompted

### **Hardware Checks**

5. **Camera Usage**
   - Close other applications using the camera (Zoom, Teams, Skype, etc.)
   - Unplug and reconnect external cameras
   - Try a different camera if available

6. **Test Camera Independently**
   - Open Windows Camera app to verify camera works
   - Test in browser: https://webcamtests.com/

### **Advanced Solutions**

7. **Windows Camera Service**
   ```
   Press Win + R > services.msc > Find "Windows Camera Frame Server"
   ```
   - Ensure the service is running
   - If stopped, right-click > Start

8. **Antivirus/Security Software**
   - Temporarily disable antivirus camera protection
   - Add Court Assistant to trusted applications

9. **Registry Check** (Advanced Users Only)
   ```
   Win + R > regedit > Navigate to:
   HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam
   ```
   - Ensure "Value" is set to "Allow"

### **Electron-Specific Solutions**

10. **Run as Administrator**
    - Right-click Court Assistant
    - Select "Run as administrator"

11. **Check Windows Defender SmartScreen**
    - Go to Windows Security > App & browser control
    - Check reputation-based protection settings

### **Error Messages and Solutions**

| Error | Likely Cause | Solution |
|-------|-------------|----------|
| `NotFoundError` | No camera detected | Check hardware connections |
| `NotAllowedError` | Permission denied | Check privacy settings |
| `NotReadableError` | Camera in use | Close other camera apps |
| `NotSupportedError` | Driver/compatibility issue | Update camera drivers |

### **Quick Test Steps**

1. ✅ **Restart the Court Assistant application**
2. ✅ **Check Windows Camera privacy settings**
3. ✅ **Close other camera applications**
4. ✅ **Test Windows Camera app**
5. ✅ **Run Court Assistant as administrator**

### **If Still Not Working**

📞 **Contact Support with:**
- Exact error message
- Camera model/type
- Windows version
- Other camera apps that work/don't work

---

💡 **Quick Fix**: Most camera access issues are resolved by checking Windows privacy settings and ensuring no other applications are using the camera. 
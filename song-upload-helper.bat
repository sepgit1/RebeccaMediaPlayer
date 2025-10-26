@echo off
echo ===========================================
echo    Rebecca Media Player - Song Upload Helper
echo ===========================================
echo.
echo This tool helps you prepare songs for Rebecca Media Player
echo.
echo INSTRUCTIONS:
echo 1. Place your audio files in a folder
echo 2. Run this script from that folder
echo 3. The script will show you file information
echo 4. Open Rebecca Media Player and use "Add Songs"
echo.
echo SUPPORTED FORMATS:
echo - MP3, WAV, AAC, OGG, M4A, FLAC
echo - Most common audio formats work
echo.
echo TIP: Organize songs in folders like:
echo   Music\Pop Songs\
echo   Music\Bedtime Songs\
echo   Music\Favorites\
echo.
echo Press any key to scan current folder...
pause >nul

echo.
echo ===========================================
echo SCANNING FOR AUDIO FILES...
echo ===========================================

set count=0
for %%f in (*.mp3 *.wav *.aac *.ogg *.m4a *.flac *.wma) do (
    set /a count+=1
    echo !count!. %%~nf%%~xf
)

echo.
echo ===========================================
echo FOUND %count% AUDIO FILES
echo ===========================================
echo.
echo To upload these songs to Rebecca Media Player:
echo 1. Open the app in your browser
echo 2. Click "📁 Add Songs"
echo 3. Select these files
echo 4. Enjoy the music!
echo.
echo Press any key to exit...
pause >nul
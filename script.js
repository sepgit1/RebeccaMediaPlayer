class MusicPlayer {
    constructor() {
        this.songs = JSON.parse(localStorage.getItem('musicPlayerSongs')) || [];
        this.comments = JSON.parse(localStorage.getItem('musicPlayerComments')) || {};
        this.currentSongIndex = 0;
        this.isPlaying = false;
        this.isShuffled = false;
        this.isRepeating = false;
        this.maxSongs = 500;
        this.ccEnabled = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadPlaylist();
        this.updateSongCounter();
        this.checkEmptyState();
        this.loadSettings();
        this.displayUserName();
        this.loadBeccaVideos();
        
        // PWA install prompt
        this.initializePWA();
    }

    initializeElements() {
        // Audio/Video elements
        this.audio = document.getElementById('audioPlayer');
        this.video = document.getElementById('videoPlayer');
        this.videoContainer = document.getElementById('videoContainer');
        this.mediaIcon = document.getElementById('mediaIcon');
        
        // Control elements
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        
        // Song info elements
        this.currentSongTitle = document.getElementById('currentSongTitle');
        this.currentSongArtist = document.getElementById('currentSongArtist');
        this.songCount = document.getElementById('songCount');
        
        // Playlist elements
        this.playlist = document.getElementById('playlist');
        this.emptyState = document.getElementById('emptyState');
        this.fileInput = document.getElementById('fileInput');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.searchInput = document.getElementById('searchInput');
        this.sortSelect = document.getElementById('sortSelect');
    }

    bindEvents() {
        // Audio events
        this.audio.addEventListener('loadedmetadata', () => {});
        this.audio.addEventListener('timeupdate', () => {});
        this.audio.addEventListener('ended', () => this.nextSong());
        this.audio.addEventListener('error', (e) => this.handleAudioError(e));

        // Control events
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.prevSong());
        this.nextBtn.addEventListener('click', () => this.nextSong());
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        
        // Update button
        const updateBtn = document.getElementById('updateBtn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.checkForUpdates());
        }
        
        // File input
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.clearAllBtn.addEventListener('click', () => this.clearAllSongs());
        
        // Drag and drop
        this.setupDragAndDrop();
        
        // Search and sort
        this.searchInput.addEventListener('input', () => this.filterPlaylist());
        this.sortSelect.addEventListener('change', () => this.sortPlaylist());
        
        // Closed Captions and Comments
        const ccBtn = document.getElementById('ccBtn');
        const closeCcBtn = document.getElementById('closeCcBtn');
        const postCommentBtn = document.getElementById('postCommentBtn');
        
        if (ccBtn) {
            ccBtn.addEventListener('click', () => this.toggleCC());
        }
        
        if (closeCcBtn) {
            closeCcBtn.addEventListener('click', () => this.hideCC());
        }
        
        if (postCommentBtn) {
            postCommentBtn.addEventListener('click', () => this.addComment());
        }
        
        // Google Drive Sync buttons (Admin only)
        const syncAuthBtn = document.getElementById('syncAuthBtn');
        const syncUploadBtn = document.getElementById('syncUploadBtn');
        const syncDownloadBtn = document.getElementById('syncDownloadBtn');
        const syncLogoutBtn = document.getElementById('syncLogoutBtn');
        
        if (syncAuthBtn) {
            syncAuthBtn.addEventListener('click', () => this.handleSyncAuth());
        }
        if (syncUploadBtn) {
            syncUploadBtn.addEventListener('click', () => this.syncAllDataToCloud());
        }
        if (syncDownloadBtn) {
            syncDownloadBtn.addEventListener('click', () => this.loadAllDataFromCloud());
        }
        if (syncLogoutBtn) {
            syncLogoutBtn.addEventListener('click', () => this.handleSyncLogout());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Highlight drop zone when dragging over
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });
        
        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.fileInput.files = files;
            
            // Trigger file upload handler
            const event = new Event('change', { bubbles: true });
            this.fileInput.dispatchEvent(event);
        });
    }

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        const mediaFiles = files.filter(file => 
            file.type.startsWith('audio/') || file.type.startsWith('video/')
        );
        
        if (this.songs.length + mediaFiles.length > this.maxSongs) {
            alert(`You can only have up to ${this.maxSongs} items. You're trying to add ${mediaFiles.length} but only have ${this.maxSongs - this.songs.length} slots available.`);
            return;
        }

        mediaFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video/');
            const song = {
                id: Date.now() + Math.random(),
                name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
                artist: isVideo ? '🎬 Video' : 'Unknown Artist',
                url: url,
                file: file,
                isVideo: isVideo,
                dateAdded: new Date().toISOString()
            };
            
            this.songs.push(song);
        });

        this.saveToStorage();
        this.loadPlaylist();
        this.updateSongCounter();
        this.checkEmptyState();
        
        // Clear file input
        this.fileInput.value = '';
        
        if (audioFiles.length > 0) {
            this.showNotification(`Added ${audioFiles.length} song(s) to your playlist!`);
        }
    }

    saveToStorage() {
        // We can't store the actual file objects or URLs in localStorage
        // So we'll store metadata and recreate URLs when needed
        const songsForStorage = this.songs.map(song => ({
            id: song.id,
            name: song.name,
            artist: song.artist,
            dateAdded: song.dateAdded,
            fileName: song.file ? song.file.name : null
        }));
        
        localStorage.setItem('musicPlayerSongs', JSON.stringify(songsForStorage));
    }

    loadPlaylist() {
        this.playlist.innerHTML = '';
        
        this.songs.forEach((song, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            
            li.innerHTML = `
                <div class="song-details">
                    <h4>${this.escapeHtml(song.name)}</h4>
                    <p>${this.escapeHtml(song.artist)}</p>
                </div>
                <div class="song-actions">
                    <button class="action-btn" onclick="musicPlayer.playSong(${index})" title="Play">▶️</button>
                </div>
            `;
            
            li.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-btn')) {
                    this.playSong(index);
                }
            });
            
            this.playlist.appendChild(li);
        });
        
        this.highlightCurrentSong();
    }

    loadBeccaVideos() {
        // Load Becca's videos from manifest
        fetch('videos/manifest.json')
            .then(response => response.json())
            .then(videos => {
                // Get the current manifest version
                const currentManifestVersion = localStorage.getItem('manifestVersion') || '1.0';
                const newManifestVersion = '2.0'; // Updated when playlist changes
                
                // If manifest has been updated, reload all videos in new order
                if (currentManifestVersion !== newManifestVersion) {
                    console.log('Manifest updated - reloading all videos in new order');
                    
                    // Remove any old videos from songs
                    this.songs = this.songs.filter(song => !song.isVideo);
                    
                    // Add all videos from manifest in the correct order
                    const formattedVideos = videos.map(video => ({
                        name: video.title,
                        artist: video.artist,
                        url: video.path,
                        isVideo: true,
                        dateAdded: video.dateAdded,
                        duration: 0
                    }));
                    
                    // Add videos at the beginning (top of list)
                    this.songs = [...formattedVideos, ...this.songs];
                    localStorage.setItem('musicPlayerSongs', JSON.stringify(this.songs));
                    localStorage.setItem('manifestVersion', newManifestVersion);
                    
                    this.loadPlaylist();
                    this.updateSongCounter();
                    this.checkEmptyState();
                    
                    this.showNotification(`✨ Playlist updated with ${videos.length} songs!`);
                } else {
                    // Check if videos already exist in localStorage
                    const videoTitles = videos.map(v => v.title);
                    const existingTitles = this.songs.map(s => s.name);
                    
                    // Add only videos that don't already exist
                    const newVideos = videos.filter(video => 
                        !existingTitles.includes(video.title)
                    );
                    
                    if (newVideos.length > 0) {
                        // Convert to the format expected by the app
                        const formattedVideos = newVideos.map(video => ({
                            name: video.title,
                            artist: video.artist,
                            url: video.path,
                            isVideo: true,
                            dateAdded: video.dateAdded,
                            duration: 0
                        }));
                        
                        // Add to playlist
                        this.songs = [...this.songs, ...formattedVideos];
                        localStorage.setItem('musicPlayerSongs', JSON.stringify(this.songs));
                        
                        // Refresh the display
                        this.loadPlaylist();
                        this.updateSongCounter();
                        this.checkEmptyState();
                        
                        this.showNotification(`✨ Added ${newVideos.length} new songs!`);
                    }
                }
            })
            .catch(error => {
                console.log('Videos not loaded (this is normal if not deployed yet):', error);
            });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    playSong(index) {
        if (index >= 0 && index < this.songs.length) {
            this.currentSongIndex = index;
            const song = this.songs[index];
            const isVideo = song.isVideo || false;
            
            this.currentSongTitle.textContent = song.name;
            this.currentSongArtist.textContent = song.artist;
            this.updateCCText(song.name);
            this.displayComments();
            
            // Toggle between audio and video player
            if (isVideo) {
                this.audio.pause();
                this.videoContainer.style.display = 'block';
                this.mediaIcon.textContent = '🎬';
                this.video.src = song.url;
                this.video.load();
                this.video.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this.highlightCurrentSong();
                }).catch(error => {
                    console.error('Error playing video:', error);
                    this.showNotification('Error playing this video. It might be corrupted.');
                });
            } else {
                this.videoContainer.style.display = 'none';
                this.mediaIcon.textContent = '🎵';
                this.audio.src = song.url;
                this.audio.load();
                this.audio.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this.highlightCurrentSong();
                }).catch(error => {
                    console.error('Error playing song:', error);
                    this.showNotification('Error playing this song. It might be corrupted.');
                });
            }
        }
    }

    isAdmin() {
        return sessionStorage.getItem('isAdmin') === 'true';
    }

    removeSong(index) {
        const adminPassword = prompt('🔐 Enter admin password to delete this song:');
        if (adminPassword !== 'Newpassadmin!') {
            if (adminPassword !== null) {
                this.showNotification('❌ Incorrect password');
            }
            return;
        }

        if (confirm('Are you sure you want to remove this song?')) {
            // Revoke the object URL to free up memory
            if (this.songs[index].url) {
                URL.revokeObjectURL(this.songs[index].url);
            }
            
            this.songs.splice(index, 1);
            
            // Adjust current song index if necessary
            if (index < this.currentSongIndex) {
                this.currentSongIndex--;
            } else if (index === this.currentSongIndex) {
                if (this.currentSongIndex >= this.songs.length) {
                    this.currentSongIndex = 0;
                }
                if (this.songs.length > 0) {
                    this.playSong(this.currentSongIndex);
                } else {
                    this.stopPlayback();
                }
            }
            
            this.saveToStorage();
            this.loadPlaylist();
            this.updateSongCounter();
            this.checkEmptyState();
            this.showNotification('🗑️ Song removed');
        }
    }

    clearAllSongs() {
        const adminPassword = prompt('🔐 Enter admin password to clear all songs:');
        if (adminPassword !== 'Newpassadmin!') {
            if (adminPassword !== null) {
                this.showNotification('❌ Incorrect password');
            }
            return;
        }

        if (this.songs.length === 0) return;
        
        if (confirm('Are you sure you want to remove all songs? This cannot be undone.')) {
            // Revoke all object URLs
            this.songs.forEach(song => {
                if (song.url) {
                    URL.revokeObjectURL(song.url);
                }
            });
            
            this.songs = [];
            this.currentSongIndex = 0;
            this.stopPlayback();
            this.saveToStorage();
            this.loadPlaylist();
            this.updateSongCounter();
            this.checkEmptyState();
            this.showNotification('All songs removed from playlist');
        }
    }

    stopPlayback() {
        this.audio.pause();
        this.audio.src = '';
        this.isPlaying = false;
        this.updatePlayButton();
        this.currentSongTitle.textContent = 'No song selected';
        this.currentSongArtist.textContent = 'Select a song to start playing';
        this.progress.style.width = '0%';
        this.currentTime.textContent = '0:00';
        this.duration.textContent = '0:00';
    }

    togglePlayPause() {
        if (this.songs.length === 0) {
            this.showNotification('Please add some songs first!');
            return;
        }

        const song = this.songs[this.currentSongIndex];
        const isVideo = song && (song.isVideo || false);
        const mediaElement = isVideo ? this.video : this.audio;

        if (mediaElement.src === '' || mediaElement.src === window.location.href) {
            this.playSong(this.currentSongIndex);
        } else {
            if (this.isPlaying) {
                mediaElement.pause();
                this.isPlaying = false;
            } else {
                mediaElement.play().then(() => {
                    this.isPlaying = true;
                }).catch(error => {
                    console.error('Error playing media:', error);
                });
            }
            this.updatePlayButton();
        }
    }

    updatePlayButton() {
        this.playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        
        // Update visualizer animation speed
        const container = document.querySelector('.container');
        if (this.isPlaying) {
            const song = this.songs[this.currentSongIndex];
            const isVideo = song && (song.isVideo || false);
            if (isVideo) {
                container.classList.add('video-playing');
                container.classList.remove('audio-playing');
            } else {
                container.classList.add('audio-playing');
                container.classList.remove('video-playing');
            }
        } else {
            container.classList.remove('audio-playing', 'video-playing');
        }
    }

    prevSong() {
        if (this.songs.length === 0) return;
        
        if (this.isShuffled) {
            this.currentSongIndex = Math.floor(Math.random() * this.songs.length);
        } else {
            this.currentSongIndex = this.currentSongIndex > 0 ? this.currentSongIndex - 1 : this.songs.length - 1;
        }
        this.playSong(this.currentSongIndex);
    }

    nextSong() {
        if (this.songs.length === 0) return;
        
        if (this.isRepeating && this.currentSongIndex < this.songs.length) {
            // Repeat current song
            this.playSong(this.currentSongIndex);
        } else if (this.isShuffled) {
            this.currentSongIndex = Math.floor(Math.random() * this.songs.length);
            this.playSong(this.currentSongIndex);
        } else {
            this.currentSongIndex = this.currentSongIndex < this.songs.length - 1 ? this.currentSongIndex + 1 : 0;
            this.playSong(this.currentSongIndex);
        }
    }

    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        this.shuffleBtn.classList.toggle('active', this.isShuffled);
        this.showNotification(this.isShuffled ? 'Shuffle enabled' : 'Shuffle disabled');
    }

    toggleRepeat() {
        this.isRepeating = !this.isRepeating;
        this.repeatBtn.classList.toggle('active', this.isRepeating);
        this.showNotification(this.isRepeating ? 'Repeat enabled' : 'Repeat disabled');
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    highlightCurrentSong() {
        const items = this.playlist.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentSongIndex);
        });
    }

    updateSongCounter() {
        this.songCount.textContent = this.songs.length;
        
        // Update color based on capacity
        if (this.songs.length >= this.maxSongs * 0.9) {
            this.songCount.style.color = '#dc3545'; // Red when near capacity
        } else if (this.songs.length >= this.maxSongs * 0.7) {
            this.songCount.style.color = '#ffa500'; // Orange when getting full
        } else {
            this.songCount.style.color = 'inherit'; // Default color
        }
    }

    checkEmptyState() {
        if (this.songs.length === 0) {
            this.emptyState.style.display = 'block';
            this.playlist.style.display = 'none';
        } else {
            this.emptyState.style.display = 'none';
            this.playlist.style.display = 'block';
        }
    }

    filterPlaylist() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const items = this.playlist.querySelectorAll('.playlist-item');
        
        items.forEach((item, index) => {
            const song = this.songs[index];
            const matchesSearch = song.name.toLowerCase().includes(searchTerm) || 
                                song.artist.toLowerCase().includes(searchTerm);
            item.style.display = matchesSearch ? 'flex' : 'none';
        });
    }

    sortPlaylist() {
        const sortBy = this.sortSelect.value;
        
        this.songs.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'artist':
                    return a.artist.localeCompare(b.artist);
                case 'date':
                    return new Date(b.dateAdded) - new Date(a.dateAdded);
                default:
                    return 0;
            }
        });
        
        this.saveToStorage();
        this.loadPlaylist();
    }

    handleKeyboard(event) {
        // Prevent default if we're not in an input field
        if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'SELECT') {
            switch (event.code) {
                case 'Space':
                    event.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    this.prevSong();
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    this.nextSong();
                    break;
            }
        }
    }

    handleAudioError(event) {
        console.error('Audio error:', event);
        const errorMessages = {
            1: 'Audio loading was aborted',
            2: 'Network error occurred',
            3: 'Audio decoding failed',
            4: 'Audio format not supported'
        };
        const errorCode = event.target.error?.code || 'Unknown';
        const message = errorMessages[errorCode] || 'Error loading this song. Please try another one.';
        this.showNotification('⚠️ ' + message);
        this.nextSong(); // Auto-skip to next song
    }

    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 1001;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 3000);
    }

    // PWA functionality
    initializePWA() {
        let deferredPrompt;
        const installPrompt = document.getElementById('installPrompt');
        const installBtn = document.getElementById('installBtn');
        const dismissBtn = document.getElementById('dismissBtn');
        const iosGuide = document.getElementById('iosInstallGuide');
        const closeIosGuide = document.getElementById('closeIosGuide');
        const installAppBtn = document.getElementById('installAppBtn');
        const installBanner = document.getElementById('installBanner');
        const closeBannerBtn = document.getElementById('closeBannerBtn');
        const bannerText = document.getElementById('bannerText');

        // Detect device type
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone === true;

        console.log('PWA Detection:', { isIOS, isSafari, isChrome, isStandalone });

        // Update banner text based on device
        if (bannerText) {
            if (isIOS && isChrome) {
                bannerText.textContent = '📱 Chrome: Tap (⋯) menu → "Add to home screen"';
            } else if (isIOS && isSafari) {
                bannerText.textContent = '📱 Safari: Tap Share button (⬆️) → "Add to Home Screen"';
            } else if (isChrome) {
                bannerText.textContent = '📱 Tap the Install button (⬇️) in the top right corner';
            } else {
                bannerText.textContent = '📱 Install this app on your device!';
            }
        }

        // Close banner button
        if (closeBannerBtn) {
            closeBannerBtn.addEventListener('click', () => {
                if (installBanner) {
                    installBanner.style.display = 'none';
                    localStorage.setItem('installBannerDismissed', 'true');
                }
            });
        }

        // Check if banner was previously dismissed
        if (localStorage.getItem('installBannerDismissed') === 'true' && installBanner) {
            installBanner.style.display = 'none';
        }

        // Listen for the beforeinstallprompt event (Chrome, Edge, Firefox Android)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            console.log('✓ Install prompt available - showing both banner and button');
            if (installPrompt) installPrompt.style.display = 'block';
            if (installAppBtn) installAppBtn.style.display = 'flex';
        });

        // Handle main install button click
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        this.showNotification('✨ Rebecca Media Player installed successfully!');
                    }
                    deferredPrompt = null;
                    if (installPrompt) installPrompt.style.display = 'none';
                }
            });
        }

        // Handle header install button click
        if (installAppBtn) {
            installAppBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        this.showNotification('✨ App installed successfully!');
                    }
                    deferredPrompt = null;
                    installAppBtn.style.display = 'none';
                }
            });
        }

        // Handle dismiss button click
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                if (installPrompt) installPrompt.style.display = 'none';
            });
        }

        // Show iOS install guide if on Safari/iOS and NOT already installed
        if (isIOS && isSafari && !isStandalone && iosGuide) {
            // Show after a short delay
            setTimeout(() => {
                iosGuide.style.display = 'block';
                console.log('✓ Showing iOS install guide');
            }, 800);
        }

        // Handle iOS guide close
        if (closeIosGuide) {
            closeIosGuide.addEventListener('click', () => {
                if (iosGuide) {
                    iosGuide.style.display = 'none';
                }
            });
        }

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('✓ Service Worker registered successfully');
                })
                .catch(error => {
                    console.log('Service Worker note:', error);
                });
        }

        // Log PWA support info
        console.log('PWA Support Summary:', {
            isIOS,
            isSafari,
            isChrome,
            isStandalone,
            hasBeforeInstallPrompt: 'onbeforeinstallprompt' in window,
            isSecure: window.location.protocol === 'https:',
            serviceWorkerSupported: 'serviceWorker' in navigator
        });
    }

    checkForUpdates() {
        // Clear service worker cache
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    caches.delete(cacheName);
                });
            });
        }

        // Clear browser cache and reload
        this.showNotification('🔄 Updating app... Please wait');
        
        // Force a hard refresh
        setTimeout(() => {
            location.reload(true);
        }, 500);
    }

    // Settings Management
    loadSettings() {
        const savedTheme = localStorage.getItem('mediaPlayerTheme') || 'dark';
        const savedColor = localStorage.getItem('mediaPlayerColor') || 'pink';
        const savedAnimations = localStorage.getItem('mediaPlayerAnimations') !== 'false';

        this.applyTheme(savedTheme);
        this.applyColorScheme(savedColor);
        this.setupSettingsModal();
        this.updateAdminUI();
        
        // Set animation toggle
        const animationsToggle = document.getElementById('animationsToggle');
        if (animationsToggle) {
            animationsToggle.checked = savedAnimations;
            animationsToggle.addEventListener('change', (e) => {
                localStorage.setItem('mediaPlayerAnimations', e.target.checked);
                document.body.style.animation = e.target.checked ? '' : 'none';
                this.showNotification(e.target.checked ? '✨ Animations enabled' : '⚡ Animations disabled');
            });
        }
    }

    updateAdminUI() {
        // Show clear all button to everyone (password protected)
        this.clearAllBtn.style.display = 'block';
    }

    setupSettingsModal() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'flex';
                this.updateAdminPanel();
            });
        }

        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.getAttribute('data-theme');
                
                // Handle auto theme (system preference)
                if (theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    this.applyTheme(prefersDark ? 'dark' : 'light');
                } else {
                    this.applyTheme(theme);
                }
            });
        });

        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.getAttribute('data-color');
                this.applyColorScheme(color);
            });
        });

        // Update Settings button
        const updateSettingsBtn = document.getElementById('updateSettingsBtn');
        if (updateSettingsBtn) {
            updateSettingsBtn.addEventListener('click', () => {
                this.showNotification('✓ Settings updated successfully');
                setTimeout(() => {
                    settingsModal.style.display = 'none';
                }, 1000);
            });
        }

        // Update active states
        this.updateSettingsUI();

        // Setup admin panel if user is admin
        this.setupAdminPanel();
    }

    setupAdminPanel() {
        // Always show admin panel to all users
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.style.display = 'block';
        }

        // Clear cache button - visible to all
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                if (confirm('Clear browser cache?')) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    });
                    this.showNotification('✨ Cache cleared successfully');
                }
            });
        }

        // Reset app button - requires admin password
        const resetAppBtn = document.getElementById('resetAppBtn');
        if (resetAppBtn) {
            resetAppBtn.addEventListener('click', () => {
                const adminPassword = prompt('🔐 Enter admin password to reset app:');
                if (adminPassword === 'Newpassadmin!') {
                    if (confirm('⚠️ Reset entire app? All songs will be deleted!')) {
                        localStorage.clear();
                        this.showNotification('🔄 App reset. Redirecting...');
                        setTimeout(() => location.reload(), 1000);
                    }
                } else if (adminPassword !== null) {
                    this.showNotification('❌ Incorrect admin password');
                }
            });
        }
    }

    updateAdminPanel() {
        if (!this.isAdmin()) return;

        // Update song count
        const adminSongCount = document.getElementById('adminSongCount');
        if (adminSongCount) {
            adminSongCount.textContent = this.songs.length;
        }

        // Calculate storage size
        const adminStorageSize = document.getElementById('adminStorageSize');
        if (adminStorageSize) {
            const storageUsed = JSON.stringify(localStorage).length / (1024 * 1024);
            adminStorageSize.textContent = storageUsed.toFixed(2);
        }
    }

    applyTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme');
        
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
            localStorage.setItem('mediaPlayerTheme', 'auto');
        } else {
            document.body.classList.add(`${theme}-theme`);
            localStorage.setItem('mediaPlayerTheme', theme);
        }

        this.updateSettingsUI();
        this.showNotification(`🌓 ${theme.charAt(0).toUpperCase() + theme.slice(1)} mode activated`);
    }

    applyColorScheme(color) {
        // Remove all color theme classes
        ['pink', 'purple', 'blue', 'green', 'orange', 'red'].forEach(c => {
            document.body.classList.remove(`${c}-theme`);
        });

        // Add the selected color theme
        document.body.classList.add(`${color}-theme`);
        localStorage.setItem('mediaPlayerColor', color);

        this.updateSettingsUI();
        this.showNotification(`🎨 Color scheme changed`);
    }

    updateSettingsUI() {
        const currentTheme = localStorage.getItem('mediaPlayerTheme') || 'dark';
        const currentColor = localStorage.getItem('mediaPlayerColor') || 'pink';

        // Update theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-theme') === currentTheme) {
                btn.classList.add('active');
            }
        });

        // Update color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-color') === currentColor) {
                btn.classList.add('active');
            }
        });
    }

    displayUserName() {
        const userName = sessionStorage.getItem('userName') || 'User';
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = `👤 ${userName}`;
        }
    }

    toggleCC() {
        const ccDisplay = document.getElementById('ccDisplay');
        this.ccEnabled = !this.ccEnabled;
        console.log('CC Toggled. Enabled:', this.ccEnabled, 'Element:', ccDisplay);
        
        if (this.ccEnabled) {
            ccDisplay.style.display = 'block';
            this.showNotification('CC enabled');
            const currentSong = this.songs[this.currentSongIndex];
            if (currentSong) {
                console.log('Updating CC with song:', currentSong.name);
                this.updateCCText(currentSong.name);
            } else {
                console.warn('No current song selected');
            }
        } else {
            ccDisplay.style.display = 'none';
            this.showNotification('CC disabled');
        }
    }

    hideCC() {
        const ccDisplay = document.getElementById('ccDisplay');
        ccDisplay.style.display = 'none';
        this.ccEnabled = false;
    }

    updateCCText(songName) {
        const ccText = document.getElementById('ccText');
        if (ccText) {
            ccText.textContent = `♪ ${songName} ♪`;
            console.log('CC Text updated:', ccText.textContent);
        } else {
            console.error('CC Text element not found');
        }
    }

    addComment() {
        const commentInput = document.getElementById('commentInput');
        const commentText = commentInput.value.trim();
        
        if (!commentText) {
            this.showNotification('Please enter a comment');
            return;
        }
        
        const currentSong = this.songs[this.currentSongIndex];
        if (!currentSong) {
            this.showNotification('Please select a song first');
            return;
        }
        
        const songId = currentSong.name + '_' + currentSong.artist;
        
        if (!this.comments[songId]) {
            this.comments[songId] = [];
        }
        
        const comment = {
            text: commentText,
            author: sessionStorage.getItem('userName') || 'Anonymous',
            timestamp: new Date().toLocaleString()
        };
        
        this.comments[songId].push(comment);
        localStorage.setItem('musicPlayerComments', JSON.stringify(this.comments));
        
        commentInput.value = '';
        this.displayComments();
        this.showNotification('✓ Comment posted!');
    }

    displayComments() {
        const currentSong = this.songs[this.currentSongIndex];
        if (!currentSong) return;
        
        const songId = currentSong.name + '_' + currentSong.artist;
        const commentsList = document.getElementById('commentsList');
        const songComments = this.comments[songId] || [];
        
        if (songComments.length === 0) {
            commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
            return;
        }
        
        commentsList.innerHTML = songComments.map((comment, idx) => `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${this.escapeHtml(comment.author)}</span>
                    <span class="comment-time">${comment.timestamp}</span>
                    <div class="comment-actions">
                        <button class="comment-btn" onclick="musicPlayer.editComment('${songId}', ${idx})" title="Edit">✏️</button>
                        <button class="comment-btn" onclick="musicPlayer.deleteComment('${songId}', ${idx})" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="comment-text">${this.escapeHtml(comment.text)}</div>
            </div>
        `).join('');
    }

    editComment(songId, index) {
        const comment = this.comments[songId][index];
        const newText = prompt('Edit your comment:', comment.text);
        
        if (newText !== null && newText.trim() !== '') {
            this.comments[songId][index].text = newText.trim();
            localStorage.setItem('musicPlayerComments', JSON.stringify(this.comments));
            this.displayComments();
            this.showNotification('✓ Comment updated!');
        }
    }

    deleteComment(songId, index) {
        if (confirm('Delete this comment?')) {
            this.comments[songId].splice(index, 1);
            localStorage.setItem('musicPlayerComments', JSON.stringify(this.comments));
            this.displayComments();
            this.showNotification('✓ Comment deleted!');
        }
    }

    displayUserName() {
        const userName = sessionStorage.getItem('userName') || 'User';
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = `👤 ${userName}`;
        }
    }

    // Google Drive Sync Methods (Admin Only)
    async initializeGoogleDriveSync() {
        try {
            if (typeof gapi === 'undefined') return false;
            
            await new Promise((resolve) => {
                gapi.load('client', resolve);
            });
            
            await googleDriveSync.initializeGoogleAPI();
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive:', error);
            return false;
        }
    }

    async authenticateGoogleDrive() {
        try {
            const result = await googleDriveSync.authenticateWithGoogle();
            if (result) {
                this.showNotification('✓ Connected to Google Drive!');
            }
            return result;
        } catch (error) {
            console.error('Error authenticating:', error);
            this.showNotification('✗ Google Drive connection failed');
            return false;
        }
    }

    async syncPlaylistToCloud() {
        try {
            if (!googleDriveSync.isAuthenticated) {
                await this.authenticateGoogleDrive();
                if (!googleDriveSync.isAuthenticated) return false;
            }
            
            await googleDriveSync.savePlaylistToGoogleDrive(this.songs);
            this.showNotification('☁️ Playlist backed up to Google Drive!');
            return true;
        } catch (error) {
            console.error('Error syncing playlist:', error);
            this.showNotification('✗ Backup failed');
            return false;
        }
    }

    async syncCommentsToCloud() {
        try {
            if (!googleDriveSync.isAuthenticated) {
                await this.authenticateGoogleDrive();
                if (!googleDriveSync.isAuthenticated) return false;
            }
            
            await googleDriveSync.saveCommentsToGoogleDrive(this.comments);
            this.showNotification('☁️ Comments backed up to Google Drive!');
            return true;
        } catch (error) {
            console.error('Error syncing comments:', error);
            this.showNotification('✗ Backup failed');
            return false;
        }
    }

    async syncAllDataToCloud() {
        try {
            if (!googleDriveSync.isAuthenticated) {
                await this.authenticateGoogleDrive();
                if (!googleDriveSync.isAuthenticated) return false;
            }
            
            await googleDriveSync.syncAllData(this.songs, this.comments);
            this.showNotification('☁️ All data backed up to Google Drive!');
            localStorage.setItem('lastGoogleDriveSync', new Date().toISOString());
            return true;
        } catch (error) {
            console.error('Error syncing all data:', error);
            this.showNotification('✗ Backup failed');
            return false;
        }
    }

    async loadAllDataFromCloud() {
        try {
            if (!googleDriveSync.isAuthenticated) {
                await this.authenticateGoogleDrive();
                if (!googleDriveSync.isAuthenticated) return false;
            }
            
            const data = await googleDriveSync.loadAllData();
            
            if (data.playlist) {
                this.songs = data.playlist;
                localStorage.setItem('musicPlayerSongs', JSON.stringify(this.songs));
            }
            
            if (data.comments) {
                this.comments = data.comments;
                localStorage.setItem('musicPlayerComments', JSON.stringify(this.comments));
            }
            
            this.loadPlaylist();
            this.displayComments();
            this.showNotification('☁️ Data restored from Google Drive!');
            return true;
        } catch (error) {
            console.error('Error loading from cloud:', error);
            this.showNotification('✗ Restore failed');
            return false;
        }
    }

    logoutGoogleDrive() {
        googleDriveSync.logout();
        this.showNotification('✓ Google Drive disconnected');
    }

    async handleSyncAuth() {
        const syncAuthBtn = document.getElementById('syncAuthBtn');
        syncAuthBtn.disabled = true;
        syncAuthBtn.textContent = '⏳ Connecting...';
        
        const success = await this.authenticateGoogleDrive();
        
        if (success) {
            this.updateSyncUI();
            syncAuthBtn.textContent = '✓ Connected!';
            setTimeout(() => {
                syncAuthBtn.textContent = '🔐 Connect to Google Drive';
                syncAuthBtn.disabled = false;
            }, 2000);
        } else {
            syncAuthBtn.textContent = '🔐 Connect to Google Drive';
            syncAuthBtn.disabled = false;
        }
    }

    handleSyncLogout() {
        this.logoutGoogleDrive();
        this.updateSyncUI();
    }

    updateSyncUI() {
        const syncAuthBtn = document.getElementById('syncAuthBtn');
        const syncUploadBtn = document.getElementById('syncUploadBtn');
        const syncDownloadBtn = document.getElementById('syncDownloadBtn');
        const syncLogoutBtn = document.getElementById('syncLogoutBtn');
        
        if (googleDriveSync.isAuthenticated) {
            syncAuthBtn.disabled = true;
            syncAuthBtn.textContent = '✓ Connected';
            syncUploadBtn.disabled = false;
            syncDownloadBtn.disabled = false;
            syncLogoutBtn.disabled = false;
        } else {
            syncAuthBtn.disabled = false;
            syncAuthBtn.textContent = '🔐 Connect to Google Drive';
            syncUploadBtn.disabled = true;
            syncDownloadBtn.disabled = true;
            syncLogoutBtn.disabled = true;
        }
    }
}

// Initialize the music player when the page loads
let musicPlayer;
document.addEventListener('DOMContentLoaded', () => {
    musicPlayer = new MusicPlayer();
    
    // Initialize Google Drive sync in background
    musicPlayer.initializeGoogleDriveSync().then(() => {
        console.log('Google Drive sync initialized');
    });
});
// Live Storage Manager - syncs changes across tabs and provides real-time updates
class LiveStorageManager {
    constructor() {
        this.listeners = new Map();
        this.storagePrefix = 'musicPlayer_';
        this.setupStorageSync();

    }

    setupStorageSync() {
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith(this.storagePrefix)) {
                const key = e.key.replace(this.storagePrefix, '');
                const callbacks = this.listeners.get(key) || [];
                callbacks.forEach(cb => cb(e.newValue ? JSON.parse(e.newValue) : null));
            }
        });
    }

    set(key, value) {
        const fullKey = this.storagePrefix + key;
        const jsonValue = JSON.stringify(value);
        localStorage.setItem(fullKey, jsonValue);
        // Trigger local listeners
        const callbacks = this.listeners.get(key) || [];
        callbacks.forEach(cb => cb(value));
    }

    get(key) {
        const fullKey = this.storagePrefix + key;
        const value = localStorage.getItem(fullKey);
        return value ? JSON.parse(value) : null;
    }

    remove(key) {
        const fullKey = this.storagePrefix + key;
        localStorage.removeItem(fullKey);
        const callbacks = this.listeners.get(key) || [];
        callbacks.forEach(cb => cb(null));
    }

    onChange(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    offChange(key, callback) {
        if (this.listeners.has(key)) {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }
}

const liveStorage = new LiveStorageManager();

class MusicPlayer {
    constructor() {
        // Initialize elements first
        this.initializeElements();
        this.bindEvents();
        
        // Set up basic state
        this.songs = [];
        this.currentSongIndex = 0;
        this.isPlaying = false;
        this.isShuffled = false;
        this.isRepeating = false;
        this.maxSongs = 500;
        
        // Load videos immediately
        this.loadBeccaVideos();
        
        // Start the first video
        setTimeout(() => {
            if (this.songs.length > 0) {
                this.playSong(0);
            }
        }, 100);
        
        // Detect if running as installed PWA
        this.isInstalledPWA = this.detectInstalledPWA();
        
        // Color palette definitions: 3 families, 4 variants each (dark, medium, light, accent)
        this.colorPalettes = {
            maroon: {
                name: 'Maroon',
                dark: '#5a0000',
                medium: '#2d0f0f',
                light: '#441c1c',
                accent: '#2d0f0f'
            },
            cyan: {
                name: 'Cyan',
                dark: '#001a40',
                medium: '#0066ff',
                light: '#00d4ff',
                accent: '#33e0ff'
            },
            forest: {
                name: 'Forest',
                dark: '#0d3d0d',
                medium: '#228b22',
                light: '#00b894',
                accent: '#55efc4'
            }
        };
        
        this.currentColorFamily = localStorage.getItem('mediaPlayerColorFamily') || 'maroon';
        
        this.initializeElements();
        this.bindEvents();
        
        // PWA install prompt
        this.initializePWA();
        
        // Initialize dynamic shapes animation
        this.initializeDynamicShapes();
        
        // Setup live storage listeners for cross-tab synchronization
        this.setupLiveStorageListeners();
    }

    setupLiveStorageListeners() {
        // Listen for songs changes from other tabs
        liveStorage.onChange('songs', (newSongs) => {
            if (newSongs && Array.isArray(newSongs)) {
                this.songs = newSongs;
                this.renderPlaylist();
                this.updateSongCounter();
                this.checkEmptyState();
            }
        });

        // Listen for comments changes from other tabs
        liveStorage.onChange('comments', (newComments) => {
            if (newComments && typeof newComments === 'object') {
                this.comments = newComments;
                this.renderPlaylist();
            }
        });
    }

    detectInstalledPWA() {
        // Check if app is running as installed PWA or Web Clip on iOS
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.matchMedia('(display-mode: minimal-ui)').matches ||
               navigator.standalone === true;
    }

    isIOSWebClip() {
        // Detect if running as iOS Web Clip (installed to home screen)
        return navigator.standalone === true || 
               (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) &&
               !navigator.userAgent.includes('CriOS') && 
               !navigator.userAgent.includes('Chrome');
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
        this.playlist = document.getElementById('playlistContainer');
        this.emptyState = document.getElementById('emptyState');
        this.fileInput = document.getElementById('fileInput');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.searchInput = document.getElementById('searchInput') || null;
        this.sortSelect = document.getElementById('sortSelect') || null;
    }

    bindEvents() {
        // Audio events
        this.audio.addEventListener('loadedmetadata', () => this.handleLoadedMetadata());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.nextSong());
        this.audio.addEventListener('error', (e) => this.handleAudioError(e));
        
        // Video events for time display
        this.video.addEventListener('loadedmetadata', () => this.updateVideoTimeDisplay());
        this.video.addEventListener('timeupdate', () => this.updateVideoTimeDisplay());
        this.video.addEventListener('ended', () => this.nextSong());

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
        
        // Search and sort (if elements exist)
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.filterPlaylist());
        }
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => this.sortPlaylist());
        }
        
        // Video controls - DISABLE FULLSCREEN
        const expandVideoBtn = document.getElementById('expandVideoBtn');
        const closeVideoBtn = document.getElementById('closeVideoBtn');
        
        if (expandVideoBtn) {
            expandVideoBtn.addEventListener('click', () => this.expandVideoFullscreen());
        }
        
        if (closeVideoBtn) {
            closeVideoBtn.addEventListener('click', () => {
                this.video.pause();
                this.videoContainer.style.display = 'none';
            });
        }
        
        // Block fullscreen attempts on video element
        this.video.addEventListener('fullscreenchange', (e) => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        });
        
        this.video.addEventListener('webkitfullscreenchange', (e) => {
            if (document.webkitFullscreenElement) {
                document.webkitExitFullscreen?.();
            }
        });
        
        this.video.addEventListener('mozfullscreenchange', (e) => {
            if (document.mozFullScreen) {
                document.mozCancelFullScreen?.();
            }
        });
        
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
        const files = Array.from(event.target.files).filter(file => 
            file.type.startsWith('audio/') || file.type.startsWith('video/')
        );
        
        if (files.length === 0) return;

        files.forEach(file => {
            const url = URL.createObjectURL(file);
            this.songs.push({
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: file.type.startsWith('video/') ? '🎬 Video' : '🎵 Music',
                url: url,
                isVideo: file.type.startsWith('video/'),
                dateAdded: new Date().toISOString()
            });
        });

        this.loadPlaylist();
        this.playSong(this.songs.length - 1); // Play the last added song
        this.fileInput.value = '';
    }

    saveToStorage() {
        // Store the complete song objects including URLs
        liveStorage.set('songs', this.songs);
    }

    loadPlaylist() {
        console.log('Updating playlist display...');
        if (!this.playlist) {
            console.error('Playlist element not found');
            return;
        }
        
        this.playlist.innerHTML = '';
        console.log(`Loading ${this.songs.length} songs into playlist`);
        
        this.songs.forEach((song, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            if (index === this.currentSongIndex) {
                li.classList.add('active');
            }
            
            li.innerHTML = `
                <div class="song-details">
                    <h4>${this.escapeHtml(song.name)}</h4>
                </div>
                <div class="song-actions">
                    <button class="action-btn">▶️</button>
                </div>
            `;
            
            li.addEventListener('click', () => this.playSong(index));
            this.playlist.appendChild(li);
        });
    }

    loadBeccaVideos() {
        console.log('Loading videos...');
        const videos = [
            "Becca Bear",
            "Didn't Know Much Before",
            "If My Dad Was President",
            "Lit The World ORIGINAL",
            "LoveHopeFaith",
            "Mine Mine Mine",
            "MissMissYou",
            "My Babies",
            "Rebeca God lit the world with you!",
            "Sceen You Around",
            "What's up"
        ];
        
        this.songs = videos.map(title => ({
            name: title,
            artist: '🎬 Rebecca',
            url: `videos/${title}.mp4`,
            isVideo: true
        }));
        
        console.log(`Loaded ${this.songs.length} videos`);
        this.loadPlaylist();
        this.updateSongCounter();
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
            
            this.currentSongTitle.textContent = song.name;
            this.currentSongArtist.textContent = song.artist;
            
            if (song.isVideo) {
                this.audio.pause();
                this.videoContainer.style.display = 'block';
                this.mediaIcon.textContent = '🎬';
                this.video.src = song.url;
                this.video.setAttribute('playsinline', 'playsinline');
                this.video.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this.highlightCurrentSong();
                }).catch(error => {
                    console.error('Error playing video:', error);
                });
            } else {
                this.videoContainer.style.display = 'none';
                this.mediaIcon.textContent = '🎵';
                this.audio.src = song.url;
                this.audio.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this.highlightCurrentSong();
                }).catch(error => {
                    console.error('Error playing audio:', error);
                });
            }
        }
    }

    expandVideoFullscreen() {
        // Create fullscreen container
        const fullscreenDiv = document.createElement('div');
        fullscreenDiv.className = 'video-fullscreen';
        fullscreenDiv.id = 'videoFullscreenContainer';
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'video-fullscreen-wrapper';
        
        // Clone video and set source
        const fullscreenVideo = document.createElement('video');
        fullscreenVideo.className = 'video-fullscreen-player';
        fullscreenVideo.src = this.video.src;
        fullscreenVideo.currentTime = this.video.currentTime;
        
        // iOS inline playback attributes
        fullscreenVideo.setAttribute('playsinline', 'playsinline');
        fullscreenVideo.setAttribute('webkit-playsinline', 'webkit-playsinline');
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'video-fullscreen-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => {
            // Exit fullscreen
            fullscreenDiv.remove();
            // Sync time back to original video
            this.video.currentTime = fullscreenVideo.currentTime;
            // Resume playing original if it was playing
            if (this.isPlaying) {
                this.video.play().catch(() => {});
            }
            this.showNotification('Exited fullscreen');
        });
        
        wrapper.appendChild(fullscreenVideo);
        fullscreenDiv.appendChild(wrapper);
        fullscreenDiv.appendChild(closeBtn);
        
        document.body.appendChild(fullscreenDiv);
        
        // Pause original and play fullscreen version
        this.video.pause();
        fullscreenVideo.play().catch(() => {});
        
        this.showNotification('📺 Fullscreen mode - Click ✕ to exit');
    }

    updateVideoTimeDisplay() {
        const currentTimeEl = document.getElementById('videoCurrentTime');
        const durationEl = document.getElementById('videoDuration');
        
        if (currentTimeEl && durationEl) {
            const current = this.formatTime(this.video.currentTime);
            const duration = this.formatTime(this.video.duration);
            currentTimeEl.textContent = current;
            durationEl.textContent = duration;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    handleLoadedMetadata() {
        const duration = this.formatTime(this.audio.duration);
        document.getElementById('duration').textContent = duration;
    }

    updateProgress() {
        const progress = document.getElementById('progress');
        const currentTimeEl = document.getElementById('currentTime');
        
        if (progress && currentTimeEl) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            progress.style.width = percent + '%';
            currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
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
        const savedColorFamily = localStorage.getItem('mediaPlayerColorFamily') || 'maroon';
        const savedAnimations = localStorage.getItem('mediaPlayerAnimations') !== 'false';
        const savedAudioMode = localStorage.getItem('mediaPlayerAudioMode') || 'normal';

        this.audioMode = savedAudioMode;
        this.applyTheme(savedTheme);
        this.applyColorFamily(savedColorFamily);
        this.setupSettingsModal();
        this.setupModesModal();
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

        // Bind color family buttons
        document.querySelectorAll('.family-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const family = e.target.getAttribute('data-family');
                this.applyColorFamily(family);
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

    setupModesModal() {
        const modesBtn = document.getElementById('modesBtn');
        const modesModal = document.getElementById('modesModal');
        const closeModesBtn = document.getElementById('closeModesBtn');

        if (modesBtn) {
            modesBtn.addEventListener('click', () => {
                modesModal.style.display = 'flex';
                this.updateModesUI();
            });
        }

        if (closeModesBtn) {
            closeModesBtn.addEventListener('click', () => {
                modesModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        modesModal.addEventListener('click', (e) => {
            if (e.target === modesModal) {
                modesModal.style.display = 'none';
            }
        });

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.getAttribute('data-mode');
                this.setAudioMode(mode);
                this.updateModesUI();
            });
        });
    }

    setAudioMode(mode) {
        this.audioMode = mode;
        liveStorage.set('audioMode', mode);
        
        // Initialize audio context if not already done
        if (!this.audioSource && this.audio) {
            this.initializeAudioContext();
        }
        
        // Resume audio context if suspended (required by browsers)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('✓ Audio context resumed');
                this.applyAudioModeEffects(mode);
            }).catch(err => console.log('Error resuming audio context:', err));
        } else {
            this.applyAudioModeEffects(mode);
        }
        
        this.showNotification(`🎵 Audio mode: ${this.getModeDisplayName(mode)}`);
    }

    getModeDisplayName(mode) {
        const names = {
            treble: 'Treble',
            bass: 'Bass',
            earphones: 'Earphones',
            tv: 'TV',
            carradio: 'Car Radio',
            bluetooth: 'Bluetooth',
            normal: 'Normal'
        };
        return names[mode] || 'Normal';
    }

    initializeAudioContext() {
        // Only initialize once
        if (this.audioContext && this.audioSource) {
            console.log('Audio context already initialized');
            return;
        }

        try {
            // Create audio context with proper error handling
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    console.error('Web Audio API not supported in this browser');
                    return;
                }
                this.audioContext = new AudioContext();
                console.log('✓ Web Audio API context created:', this.audioContext);
            }

            // Verify audio context was created
            if (!this.audioContext) {
                console.error('Failed to create audio context');
                return;
            }

            // Create audio source from the audio element
            if (!this.audioSource && this.audio) {
                // Verify the audio context has the required method
                if (typeof this.audioContext.createMediaElementSource !== 'function') {
                    console.error('Audio context does not have createMediaElementSource method');
                    return;
                }

                this.audioSource = this.audioContext.createMediaElementSource(this.audio);
                console.log('✓ Audio source created from audio element');

                // Create filter nodes
                this.bassFilter = this.audioContext.createBiquadFilter();
                this.midFilter = this.audioContext.createBiquadFilter();
                this.trebleFilter = this.audioContext.createBiquadFilter();
                this.gainNode = this.audioContext.createGain();
                this.analyser = this.audioContext.createAnalyser();

                // Setup filters
                this.bassFilter.type = 'lowshelf';
                this.bassFilter.frequency.value = 200;

                this.midFilter.type = 'peaking';
                this.midFilter.frequency.value = 1000;
                this.midFilter.Q.value = 0.5;

                this.trebleFilter.type = 'highshelf';
                this.trebleFilter.frequency.value = 3000;

                // Connect nodes: source -> bass -> mid -> treble -> gain -> analyser -> destination
                this.audioSource.connect(this.bassFilter);
                this.bassFilter.connect(this.midFilter);
                this.midFilter.connect(this.trebleFilter);
                this.trebleFilter.connect(this.gainNode);
                this.gainNode.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);

                this.gainNode.gain.value = 1.0;

                console.log('✓ Audio nodes connected and ready');
                console.log('Audio chain:', 'Source → Bass → Mid → Treble → Gain → Analyser → Output');

                // Apply current audio mode
                this.applyAudioModeEffects(this.audioMode);
            }
        } catch (e) {
            console.error('Error initializing Web Audio API:', e);
            if (e && e.message) console.error('Error message:', e.message);
            if (e && e.stack) console.error('Error stack:', e.stack);
        }
    }

    applyAudioModeEffects(mode) {
        // Make sure audio context and filters exist
        if (!this.audioContext || !this.bassFilter || !this.midFilter || !this.trebleFilter) {
            console.log('Audio nodes not initialized yet, cannot apply mode:', mode);
            return;
        }

        console.log(`Applying audio mode: ${mode}`);
        console.log('Audio Context State:', this.audioContext.state);

        // Reset all filters first
        this.bassFilter.gain.value = 0;
        this.midFilter.gain.value = 0;
        this.trebleFilter.gain.value = 0;
        this.gainNode.gain.value = 1.0;

        // Apply EQ for different modes
        switch(mode) {
            case 'treble':
                // Boost treble (high frequencies) - 12dB boost
                this.trebleFilter.gain.value = 12;
                this.midFilter.gain.value = 3;
                this.bassFilter.gain.value = -8;
                console.log('🎸 Treble mode applied - bass:-8dB, mid:+3dB, treble:+12dB');
                break;
            case 'bass':
                // Boost bass (low frequencies) - 15dB boost
                this.bassFilter.gain.value = 15;
                this.midFilter.gain.value = -2;
                this.trebleFilter.gain.value = -6;
                console.log('🥁 Bass mode applied - bass:+15dB, mid:-2dB, treble:-6dB');
                break;
            case 'earphones':
                // Balanced for small drivers
                this.bassFilter.gain.value = 5;
                this.midFilter.gain.value = 3;
                this.trebleFilter.gain.value = 4;
                console.log('🎧 Earphones mode applied - bass:+5dB, mid:+3dB, treble:+4dB');
                break;
            case 'tv':
                // Full spectrum for speaker systems
                this.bassFilter.gain.value = 3;
                this.midFilter.gain.value = 2;
                this.trebleFilter.gain.value = 2;
                console.log('📺 TV mode applied - bass:+3dB, mid:+2dB, treble:+2dB');
                break;
            case 'carradio':
                // Compressed, punchy sound for car
                this.bassFilter.gain.value = 8;
                this.midFilter.gain.value = 6;
                this.trebleFilter.gain.value = 3;
                this.gainNode.gain.value = 0.85;
                console.log('🚗 Car Radio mode applied - bass:+8dB, mid:+6dB, treble:+3dB, gain:0.85');
                break;
            case 'bluetooth':
                // Wireless speaker optimization
                this.bassFilter.gain.value = 2;
                this.midFilter.gain.value = 4;
                this.trebleFilter.gain.value = 6;
                console.log('🔵 Bluetooth mode applied - bass:+2dB, mid:+4dB, treble:+6dB');
                break;
            default:
                // Normal/flat response
                console.log('Normal audio mode - flat response applied');
        }

        // Log current filter values for debugging
        console.log('Filter values:', {
            bass: this.bassFilter.gain.value,
            mid: this.midFilter.gain.value,
            treble: this.trebleFilter.gain.value,
            gain: this.gainNode.gain.value
        });

    }

    updateModesUI() {
        // Update active state of mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            const mode = btn.getAttribute('data-mode');
            if (mode === this.audioMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update current mode display
        const currentModeDisplay = document.getElementById('currentModeDisplay');
        if (currentModeDisplay) {
            currentModeDisplay.innerHTML = `Current Mode: <strong>${this.getModeDisplayName(this.audioMode)}</strong>`;
        }
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

    applyColorFamily(familyKey) {
        const palette = this.colorPalettes[familyKey];
        this.currentColorFamily = familyKey;
        localStorage.setItem('mediaPlayerColorFamily', familyKey);

        // Cycle through all 4 colors in the family
        const colors = [palette.dark, palette.medium, palette.light, palette.accent];

        // Update CSS custom properties with the family colors
        document.documentElement.style.setProperty('--primary-color', palette.light);
        document.documentElement.style.setProperty('--secondary-color', palette.medium);
        document.documentElement.style.setProperty('--tertiary-color', palette.dark);
        document.documentElement.style.setProperty('--accent-color', palette.accent);

        // Update active button states
        document.querySelectorAll('.family-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-family') === familyKey) {
                btn.classList.add('active');
            }
        });

        // Update dynamic shapes colors to use all 4 colors from family
        this.updateShapesColors(colors);

        this.showNotification(`🎨 Switched to ${palette.name} family`);
    }

    updateShapesColors(colors) {
        // Update canvas shape colors to match the new palette
        const shapes = this.shapes || [];
        shapes.forEach(shape => {
            shape.color = colors[Math.floor(Math.random() * colors.length)];
        });
    }

    updateSettingsUI() {
        const currentTheme = localStorage.getItem('mediaPlayerTheme') || 'dark';
        const currentColorFamily = localStorage.getItem('mediaPlayerColorFamily') || 'maroon';

        // Update theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-theme') === currentTheme) {
                btn.classList.add('active');
            }
        });

        // Update family buttons
        document.querySelectorAll('.family-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-family') === currentColorFamily) {
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
        liveStorage.set('comments', this.comments);
        
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
            liveStorage.set('comments', this.comments);
            this.displayComments();
            this.showNotification('✓ Comment updated!');
        }
    }

    deleteComment(songId, index) {
        if (confirm('Delete this comment?')) {
            this.comments[songId].splice(index, 1);
            liveStorage.set('comments', this.comments);
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
                liveStorage.set('songs', this.songs);
            }
            
            if (data.comments) {
                this.comments = data.comments;
                liveStorage.set('comments', this.comments);
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

    initializeDynamicShapes() {
        // Create bubbles container if it doesn't exist
        let bubblesContainer = document.querySelector('.bubbles');
        if (!bubblesContainer) {
            bubblesContainer = document.createElement('div');
            bubblesContainer.className = 'bubbles';
            document.body.insertBefore(bubblesContainer, document.body.firstChild);
        }

        // Create bubbles
        const numBubbles = 20;
        for (let i = 0; i < numBubbles; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            
            // Random size between 30px and 120px
            const size = Math.random() * 90 + 30;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            
            // Random starting position
            bubble.style.left = `${Math.random() * 100}%`;
            bubble.style.top = `${Math.random() * 100}%`;
            
            // Random animation properties
            const tx = Math.random() * 400 - 200; // translate X between -200px and 200px
            const ty = Math.random() * 400 - 200; // translate Y between -200px and 200px
            bubble.style.setProperty('--tx', `${tx}px`);
            bubble.style.setProperty('--ty', `${ty}px`);
            
            // Random animation duration between 15s and 30s
            bubble.style.animationDuration = `${Math.random() * 15 + 15}s`;
            // Random animation delay
            bubble.style.animationDelay = `${Math.random() * -30}s`;
            
            bubblesContainer.appendChild(bubble);
        }
            }

        // Animation loop
        const updateAnimation = () => {

        // Animation loop
        let updateAnimation = () => {
            if (!this.ctx || !this.canvas) return;
            
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw and update shapes
            for (let s of this.shapes) {
                // Update position
                s.x += s.dx;
                s.y += s.dy;
                if (s.x < 0 || s.x > this.canvas.width) s.dx *= -1;
                if (s.y < 0 || s.y > this.canvas.height) s.dy *= -1;
                
                // Draw shape
                this.ctx.fillStyle = s.color;
                this.ctx.beginPath();
                switch (s.shape) {
                    case "circle":
                        this.ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
                        break;
                    case "square":
                        this.ctx.rect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
                        break;
                    case "triangle":
                        this.ctx.moveTo(s.x, s.y - s.size / 2);
                        this.ctx.lineTo(s.x - s.size / 2, s.y + s.size / 2);
                        this.ctx.lineTo(s.x + s.size / 2, s.y + s.size / 2);
                        this.ctx.closePath();
                        break;
                }
                this.ctx.fill();
            }
            
            requestAnimationFrame(updateAnimation);
        };
        
        // Start the animation
        updateAnimation();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            
            // Keep shapes within bounds
            this.shapes.forEach(s => {
                if (s.x > this.canvas.width) s.x = this.canvas.width - s.size;
                if (s.y > this.canvas.height) s.y = this.canvas.height - s.size;
            });
        });
    }
}

// Initialize the music player when the page loads
let musicPlayer;
window.addEventListener('load', () => {
    try {
        musicPlayer = new MusicPlayer();
        console.log('Music player initialized');
        
        // Initialize UI elements
        const dropArea = document.querySelector('.drop-area');
        if (dropArea) {
            dropArea.style.display = 'block';
        }
        
        const addSongBtn = document.getElementById('addSongBtn');
        if (addSongBtn) {
            addSongBtn.style.display = 'block';
        }
        
        // Load existing songs
        if (musicPlayer.songs && musicPlayer.songs.length > 0) {
            console.log('Loading existing songs:', musicPlayer.songs.length);
            musicPlayer.loadPlaylist();
        } else {
            console.log('No existing songs found');
            musicPlayer.checkEmptyState();
        }
    } catch (error) {
        console.error('Error initializing music player:', error);
    }
});
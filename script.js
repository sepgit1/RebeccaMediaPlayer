class MusicPlayer {
    constructor() {
        this.songs = JSON.parse(localStorage.getItem('musicPlayerSongs')) || [];
        this.currentSongIndex = 0;
        this.isPlaying = false;
        this.isShuffled = false;
        this.isRepeating = false;
        this.maxSongs = 500;
        
        this.initializeElements();
        this.bindEvents();
        this.loadPlaylist();
        this.updateSongCounter();
        this.checkEmptyState();
        this.loadSettings();
        
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
            
            const deleteButton = this.isAdmin() ? 
                `<button class="action-btn" onclick="musicPlayer.removeSong(${index})" title="Remove">🗑️</button>` : '';
            
            li.innerHTML = `
                <div class="song-details">
                    <h4>${this.escapeHtml(song.name)}</h4>
                    <p>${this.escapeHtml(song.artist)}</p>
                </div>
                <div class="song-actions">
                    <button class="action-btn" onclick="musicPlayer.playSong(${index})" title="Play">▶️</button>
                    ${deleteButton}
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
        if (!this.isAdmin()) {
            this.showNotification('❌ Only admins can delete songs');
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
        if (!this.isAdmin()) {
            this.showNotification('❌ Only admins can clear all songs');
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

        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installPrompt.style.display = 'block';
        });

        // Handle install button click
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    this.showNotification('Rebecca Media Player installed successfully!');
                }
                deferredPrompt = null;
                installPrompt.style.display = 'none';
            }
        });

        // Handle dismiss button click
        dismissBtn.addEventListener('click', () => {
            installPrompt.style.display = 'none';
        });

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
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
        // Hide clear all button for non-admins
        if (!this.isAdmin()) {
            this.clearAllBtn.style.display = 'none';
        }
    }

    setupSettingsModal() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'flex';
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

        // Update active states
        this.updateSettingsUI();
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
}

// Initialize the music player when the page loads
let musicPlayer;
document.addEventListener('DOMContentLoaded', () => {
    musicPlayer = new MusicPlayer();
});
/**
 * CALL CENTER MODULE v2.0
 * Complete Phone, Video, Recording, and Transcription System for THE HULL
 */

(function(global) {
    'use strict';

    // ============================================================================
    // SECTION 1: DATABASE MANAGER - IndexedDB for persistent storage
    // ============================================================================

    class DatabaseManager {
        constructor() {
            this.dbName = 'CallCenterDB';
            this.dbVersion = 2;
            this.db = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains('audioRecordings')) {
                        const audioStore = db.createObjectStore('audioRecordings', { keyPath: 'id', autoIncrement: true });
                        audioStore.createIndex('contactName', 'contactName', { unique: false });
                        audioStore.createIndex('date', 'date', { unique: false });
                        audioStore.createIndex('fileName', 'fileName', { unique: true });
                    }

                    if (!db.objectStoreNames.contains('transcriptions')) {
                        const transcriptStore = db.createObjectStore('transcriptions', { keyPath: 'id', autoIncrement: true });
                        transcriptStore.createIndex('contactName', 'contactName', { unique: false });
                        transcriptStore.createIndex('date', 'date', { unique: false });
                        transcriptStore.createIndex('fileName', 'fileName', { unique: true });
                        transcriptStore.createIndex('audioId', 'audioId', { unique: false });
                    }

                    if (!db.objectStoreNames.contains('contacts')) {
                        const contactStore = db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
                        contactStore.createIndex('name', 'name', { unique: false });
                        contactStore.createIndex('email', 'email', { unique: false });
                        contactStore.createIndex('googleId', 'googleId', { unique: false });
                    }

                    if (!db.objectStoreNames.contains('callHistory')) {
                        const historyStore = db.createObjectStore('callHistory', { keyPath: 'id', autoIncrement: true });
                        historyStore.createIndex('contactName', 'contactName', { unique: false });
                        historyStore.createIndex('date', 'date', { unique: false });
                        historyStore.createIndex('type', 'type', { unique: false });
                    }
                };
            });
        }

        async saveAudioRecording(contactName, audioBlob, duration) {
            const date = new Date();
            const fileName = this.generateFileName(contactName, date, 'audio');

            const arrayBuffer = await audioBlob.arrayBuffer();

            const record = {
                contactName: contactName,
                date: date.toISOString(),
                fileName: fileName,
                audioData: arrayBuffer,
                mimeType: audioBlob.type,
                duration: duration,
                size: audioBlob.size,
                transcribed: false
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioRecordings'], 'readwrite');
                const store = transaction.objectStore('audioRecordings');
                const request = store.add(record);

                request.onsuccess = () => resolve({ id: request.result, fileName: fileName });
                request.onerror = () => reject(request.error);
            });
        }

        async saveTranscription(audioId, contactName, transcriptionText) {
            const date = new Date();
            const fileName = this.generateFileName(contactName, date, 'transcript');

            const record = {
                audioId: audioId,
                contactName: contactName,
                date: date.toISOString(),
                fileName: fileName,
                text: transcriptionText,
                wordCount: transcriptionText.split(/\s+/).length
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['transcriptions', 'audioRecordings'], 'readwrite');

                const transcriptStore = transaction.objectStore('transcriptions');
                const audioStore = transaction.objectStore('audioRecordings');

                const addRequest = transcriptStore.add(record);

                addRequest.onsuccess = () => {
                    const getRequest = audioStore.get(audioId);
                    getRequest.onsuccess = () => {
                        const audioRecord = getRequest.result;
                        if (audioRecord) {
                            audioRecord.transcribed = true;
                            audioRecord.transcriptionId = addRequest.result;
                            audioStore.put(audioRecord);
                        }
                    };
                    resolve({ id: addRequest.result, fileName: fileName });
                };
                addRequest.onerror = () => reject(addRequest.error);
            });
        }

        async getAllAudioRecordings() {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioRecordings'], 'readonly');
                const store = transaction.objectStore('audioRecordings');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async getAllTranscriptions() {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['transcriptions'], 'readonly');
                const store = transaction.objectStore('transcriptions');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async getAudioRecording(id) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioRecordings'], 'readonly');
                const store = transaction.objectStore('audioRecordings');
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async getTranscription(id) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['transcriptions'], 'readonly');
                const store = transaction.objectStore('transcriptions');
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async deleteAudioRecording(id) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioRecordings', 'transcriptions'], 'readwrite');
                const audioStore = transaction.objectStore('audioRecordings');
                const transcriptStore = transaction.objectStore('transcriptions');

                const index = transcriptStore.index('audioId');
                const cursorRequest = index.openCursor(IDBKeyRange.only(id));

                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };

                const deleteRequest = audioStore.delete(id);
                deleteRequest.onsuccess = () => resolve(true);
                deleteRequest.onerror = () => reject(deleteRequest.error);
            });
        }

        async deleteTranscription(id) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['transcriptions'], 'readwrite');
                const store = transaction.objectStore('transcriptions');
                const request = store.delete(id);

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        }

        async updateRecordingTranscript(id, liveTranscript) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioRecordings'], 'readwrite');
                const store = transaction.objectStore('audioRecordings');
                const getRequest = store.get(id);

                getRequest.onsuccess = () => {
                    const record = getRequest.result;
                    if (record) {
                        record.liveTranscript = liveTranscript;
                        const putRequest = store.put(record);
                        putRequest.onsuccess = () => resolve(true);
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        reject(new Error('Recording not found'));
                    }
                };

                getRequest.onerror = () => reject(getRequest.error);
            });
        }

        async saveContact(contact) {
            const record = {
                googleId: contact.id || '',
                name: contact.name || '',
                phone: contact.phone || '',
                email: contact.email || '',
                company: contact.company || '',
                photo: contact.photo || null,
                syncedAt: new Date().toISOString()
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['contacts'], 'readwrite');
                const store = transaction.objectStore('contacts');
                const request = store.add(record);

                request.onsuccess = () => resolve({ id: request.result, ...record });
                request.onerror = () => reject(request.error);
            });
        }

        async clearContacts() {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['contacts'], 'readwrite');
                const store = transaction.objectStore('contacts');
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        }

        async getAllContacts() {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['contacts'], 'readonly');
                const store = transaction.objectStore('contacts');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async saveCallHistory(contactName, type, duration, platform) {
            const record = {
                contactName: contactName,
                type: type,
                duration: duration,
                platform: platform || '',
                date: new Date().toISOString()
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['callHistory'], 'readwrite');
                const store = transaction.objectStore('callHistory');
                const request = store.add(record);

                request.onsuccess = () => resolve({ id: request.result, ...record });
                request.onerror = () => reject(request.error);
            });
        }

        generateFileName(contactName, date, type) {
            const sanitizedName = contactName.replace(/[^a-zA-Z0-9]/g, '_');
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
            const extension = type === 'audio' ? 'webm' : 'txt';
            return `${sanitizedName}_${dateStr}_${timeStr}.${extension}`;
        }
    }

    // ============================================================================
    // SECTION 2: AUDIO RECORDER - MediaRecorder API implementation
    // ============================================================================

    class AudioRecorder {
        constructor(database) {
            this.database = database;
            this.mediaRecorder = null;
            this.audioChunks = [];
            this.stream = null;
            this.isRecording = false;
            this.isPaused = false;
            this.startTime = null;
            this.pausedDuration = 0;
            this.currentContactName = 'Unknown';
            this.onRecordingStart = null;
            this.onRecordingStop = null;
            this.onRecordingPause = null;
            this.onRecordingResume = null;
            this.onDataAvailable = null;
            this.onError = null;
            this.recordingTimer = null;
            this.elapsedTime = 0;
        }

        async init() {
            try {
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 44100,
                        channelCount: 1
                    }
                };

                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                return true;
            } catch (error) {
                console.error('Failed to initialize audio recorder:', error);
                if (this.onError) this.onError(error);
                return false;
            }
        }

        async startRecording(contactName = 'Unknown') {
            if (this.isRecording) {
                console.warn('Recording already in progress');
                return false;
            }

            if (!this.stream) {
                const initialized = await this.init();
                if (!initialized) return false;
            }

            this.currentContactName = contactName;
            this.audioChunks = [];
            this.startTime = Date.now();
            this.pausedDuration = 0;
            this.elapsedTime = 0;

            const mimeType = this.getSupportedMimeType();

            try {
                this.mediaRecorder = new MediaRecorder(this.stream, {
                    mimeType: mimeType,
                    audioBitsPerSecond: 128000
                });

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                        if (this.onDataAvailable) this.onDataAvailable(event.data);
                    }
                };

                this.mediaRecorder.onstop = async () => {
                    await this.handleRecordingStop();
                };

                this.mediaRecorder.onerror = (event) => {
                    console.error('MediaRecorder error:', event.error);
                    if (this.onError) this.onError(event.error);
                };

                this.mediaRecorder.start(1000);
                this.isRecording = true;
                this.isPaused = false;

                this.startTimer();

                if (this.onRecordingStart) {
                    this.onRecordingStart({
                        contactName: this.currentContactName,
                        startTime: this.startTime
                    });
                }

                return true;
            } catch (error) {
                console.error('Failed to start recording:', error);
                if (this.onError) this.onError(error);
                return false;
            }
        }

        stopRecording() {
            if (!this.isRecording || !this.mediaRecorder) {
                console.warn('No recording in progress');
                return false;
            }

            this.stopTimer();
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;

            return true;
        }

        pauseRecording() {
            if (!this.isRecording || this.isPaused || !this.mediaRecorder) {
                return false;
            }

            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseStartTime = Date.now();
            this.stopTimer();

            if (this.onRecordingPause) {
                this.onRecordingPause({ elapsedTime: this.elapsedTime });
            }

            return true;
        }

        resumeRecording() {
            if (!this.isRecording || !this.isPaused || !this.mediaRecorder) {
                return false;
            }

            this.pausedDuration += Date.now() - this.pauseStartTime;
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.startTimer();

            if (this.onRecordingResume) {
                this.onRecordingResume({ elapsedTime: this.elapsedTime });
            }

            return true;
        }

        async handleRecordingStop() {
            const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
            const duration = this.elapsedTime;

            try {
                const result = await this.database.saveAudioRecording(
                    this.currentContactName,
                    audioBlob,
                    duration
                );

                if (this.onRecordingStop) {
                    this.onRecordingStop({
                        id: result.id,
                        fileName: result.fileName,
                        contactName: this.currentContactName,
                        duration: duration,
                        size: audioBlob.size,
                        blob: audioBlob
                    });
                }

                return result;
            } catch (error) {
                console.error('Failed to save recording:', error);
                if (this.onError) this.onError(error);
                return null;
            }
        }

        startTimer() {
            this.recordingTimer = setInterval(() => {
                if (!this.isPaused) {
                    this.elapsedTime = Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000);
                }
            }, 100);
        }

        stopTimer() {
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
        }

        getSupportedMimeType() {
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4',
                'audio/mpeg'
            ];

            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    return mimeType;
                }
            }

            return 'audio/webm';
        }

        getRecordingState() {
            return {
                isRecording: this.isRecording,
                isPaused: this.isPaused,
                elapsedTime: this.elapsedTime,
                contactName: this.currentContactName
            };
        }

        destroy() {
            this.stopRecording();
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
        }
    }

    // ============================================================================
    // SECTION 3: TRANSCRIPTION SERVICE - Live Speech Recognition
    // ============================================================================

    class TranscriptionService {
        constructor(database) {
            this.database = database;
            this.recognition = null;
            this.isTranscribing = false;
            this.currentTranscript = '';
            this.liveTranscript = '';
            this.onTranscriptionStart = null;
            this.onTranscriptionProgress = null;
            this.onTranscriptionComplete = null;
            this.onTranscriptionError = null;
            this.onLiveTranscriptUpdate = null;
        }

        // Start live transcription (call when recording starts)
        startLiveTranscription() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            if (!SpeechRecognition) {
                console.warn('Speech recognition not supported in this browser');
                return false;
            }

            try {
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = true;
                this.recognition.interimResults = true;
                this.recognition.lang = 'en-US';
                this.liveTranscript = '';
                this.isTranscribing = true;

                this.recognition.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript + ' ';
                            this.liveTranscript += transcript + ' ';
                        } else {
                            interimTranscript += transcript;
                        }
                    }

                    if (this.onLiveTranscriptUpdate) {
                        this.onLiveTranscriptUpdate({
                            final: this.liveTranscript,
                            interim: interimTranscript
                        });
                    }
                };

                this.recognition.onerror = (event) => {
                    console.warn('Speech recognition error:', event.error);
                    // Try to restart on recoverable errors
                    if (event.error === 'no-speech' || event.error === 'aborted') {
                        if (this.isTranscribing) {
                            setTimeout(() => {
                                try {
                                    this.recognition.start();
                                } catch (e) {}
                            }, 500);
                        }
                    }
                };

                this.recognition.onend = () => {
                    // Auto-restart if still transcribing
                    if (this.isTranscribing) {
                        setTimeout(() => {
                            try {
                                this.recognition.start();
                            } catch (e) {}
                        }, 100);
                    }
                };

                this.recognition.start();
                console.log('Live transcription started');
                return true;
            } catch (error) {
                console.error('Failed to start live transcription:', error);
                return false;
            }
        }

        // Stop live transcription (call when recording stops)
        stopLiveTranscription() {
            this.isTranscribing = false;
            if (this.recognition) {
                try {
                    this.recognition.stop();
                } catch (e) {}
                this.recognition = null;
            }
            const transcript = this.liveTranscript.trim();
            console.log('Live transcription stopped. Transcript length:', transcript.length);
            return transcript;
        }

        // Get the current live transcript
        getLiveTranscript() {
            return this.liveTranscript;
        }

        // Clear the live transcript
        clearLiveTranscript() {
            this.liveTranscript = '';
        }

        // Transcribe an audio recording (uses saved live transcript or prompts for manual entry)
        async transcribeAudioFile(audioId) {
            try {
                const audioRecord = await this.database.getAudioRecording(audioId);
                if (!audioRecord) {
                    throw new Error('Audio recording not found');
                }

                if (this.onTranscriptionStart) {
                    this.onTranscriptionStart({ audioId, fileName: audioRecord.fileName });
                }

                // Check if there's a live transcript saved with the recording
                let transcriptionText = '';

                if (audioRecord.liveTranscript && audioRecord.liveTranscript.trim()) {
                    // Use the live transcript that was captured during recording
                    transcriptionText = this.formatTranscription(audioRecord, audioRecord.liveTranscript);
                } else {
                    // No live transcript available - prompt user to speak while playing audio
                    transcriptionText = await this.transcribeByListening(audioRecord);
                }

                const result = await this.database.saveTranscription(
                    audioId,
                    audioRecord.contactName,
                    transcriptionText
                );

                if (this.onTranscriptionComplete) {
                    this.onTranscriptionComplete({
                        id: result.id,
                        fileName: result.fileName,
                        text: transcriptionText,
                        audioId: audioId
                    });
                }

                return result;
            } catch (error) {
                console.error('Transcription failed:', error);
                if (this.onTranscriptionError) {
                    this.onTranscriptionError(error);
                }
                throw error;
            }
        }

        // Transcribe by listening through the microphone while playing audio
        async transcribeByListening(audioRecord) {
            return new Promise((resolve) => {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

                if (!SpeechRecognition) {
                    resolve(this.formatTranscription(audioRecord, '[Speech recognition not available. Use Chrome browser.]'));
                    return;
                }

                // Create audio element to play the recording
                const audioBlob = new Blob([audioRecord.audioData], { type: audioRecord.mimeType });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.volume = 1.0;

                // Initialize speech recognition to listen via microphone
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                let finalTranscript = '';
                let isListening = true;

                recognition.onresult = (event) => {
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript + ' ';
                        }
                    }

                    if (this.onTranscriptionProgress) {
                        this.onTranscriptionProgress({ final: finalTranscript, interim: '' });
                    }
                };

                recognition.onerror = (event) => {
                    console.warn('Recognition error during playback:', event.error);
                };

                recognition.onend = () => {
                    if (isListening && !audio.ended && !audio.paused) {
                        try {
                            recognition.start();
                        } catch (e) {}
                    }
                };

                audio.onended = () => {
                    isListening = false;
                    setTimeout(() => {
                        try {
                            recognition.stop();
                        } catch (e) {}
                        URL.revokeObjectURL(audioUrl);

                        const transcriptContent = finalTranscript.trim() || '[No speech detected. Try playing the audio near your microphone or ensure microphone permission is granted.]';
                        resolve(this.formatTranscription(audioRecord, transcriptContent));
                    }, 1500);
                };

                audio.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve(this.formatTranscription(audioRecord, '[Error playing audio file]'));
                };

                // Start recognition and play audio (user should listen through speakers while mic picks up)
                try {
                    recognition.start();
                    audio.play();
                    console.log('Playing audio for transcription - microphone is listening');
                } catch (e) {
                    console.error('Failed to start transcription playback:', e);
                    resolve(this.formatTranscription(audioRecord, '[Failed to start transcription]'));
                }
            });
        }

        formatTranscription(audioRecord, transcriptContent) {
            const date = new Date(audioRecord.date);
            return `TRANSCRIPTION\n` +
                   `Contact: ${audioRecord.contactName}\n` +
                   `Date: ${date.toLocaleString()}\n` +
                   `Duration: ${this.formatDuration(audioRecord.duration)}\n` +
                   `File: ${audioRecord.fileName}\n` +
                   `─────────────────────────────────\n\n` +
                   transcriptContent;
        }

        formatDuration(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // ============================================================================
    // SECTION 4: PEERJS WEBRTC CALLING SERVICE
    // ============================================================================

    class PeerCallService {
        constructor() {
            this.peer = null;
            this.currentCall = null;
            this.localStream = null;
            this.remoteStream = null;
            this.peerId = null;
            this.isInCall = false;
            this.onCallStart = null;
            this.onCallEnd = null;
            this.onCallError = null;
            this.onPeerIdReady = null;
            this.onIncomingCall = null;
            this.callStartTime = null;
            this.callTimer = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                try {
                    // Generate a unique peer ID
                    const uniqueId = 'hull_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

                    this.peer = new Peer(uniqueId, {
                        debug: 2,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' },
                                { urls: 'stun:stun2.l.google.com:19302' }
                            ]
                        }
                    });

                    this.peer.on('open', (id) => {
                        this.peerId = id;
                        console.log('PeerJS initialized with ID:', id);
                        if (this.onPeerIdReady) this.onPeerIdReady(id);
                        resolve(id);
                    });

                    this.peer.on('call', (call) => {
                        console.log('Incoming call from:', call.peer);
                        if (this.onIncomingCall) {
                            this.onIncomingCall(call);
                        } else {
                            // Auto-answer if no handler
                            this.answerCall(call);
                        }
                    });

                    this.peer.on('error', (err) => {
                        console.error('PeerJS error:', err);
                        if (this.onCallError) this.onCallError(err);
                        reject(err);
                    });

                    this.peer.on('disconnected', () => {
                        console.log('PeerJS disconnected');
                        this.endCall();
                    });

                } catch (error) {
                    console.error('Failed to initialize PeerJS:', error);
                    reject(error);
                }
            });
        }

        async getLocalStream() {
            if (this.localStream) return this.localStream;

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });
                return this.localStream;
            } catch (error) {
                console.error('Failed to get local audio stream:', error);
                throw error;
            }
        }

        async startCall(remotePeerId) {
            if (this.isInCall) {
                console.warn('Already in a call');
                return false;
            }

            try {
                const stream = await this.getLocalStream();
                this.currentCall = this.peer.call(remotePeerId, stream);

                this.currentCall.on('stream', (remoteStream) => {
                    this.remoteStream = remoteStream;
                    this.playRemoteStream(remoteStream);
                    this.isInCall = true;
                    this.callStartTime = Date.now();
                    this.startCallTimer();
                    if (this.onCallStart) this.onCallStart({ remotePeerId, stream: remoteStream });
                });

                this.currentCall.on('close', () => {
                    this.endCall();
                });

                this.currentCall.on('error', (err) => {
                    console.error('Call error:', err);
                    if (this.onCallError) this.onCallError(err);
                    this.endCall();
                });

                return true;
            } catch (error) {
                console.error('Failed to start call:', error);
                if (this.onCallError) this.onCallError(error);
                return false;
            }
        }

        async answerCall(call) {
            try {
                const stream = await this.getLocalStream();
                call.answer(stream);
                this.currentCall = call;

                call.on('stream', (remoteStream) => {
                    this.remoteStream = remoteStream;
                    this.playRemoteStream(remoteStream);
                    this.isInCall = true;
                    this.callStartTime = Date.now();
                    this.startCallTimer();
                    if (this.onCallStart) this.onCallStart({ remotePeerId: call.peer, stream: remoteStream });
                });

                call.on('close', () => {
                    this.endCall();
                });

                call.on('error', (err) => {
                    console.error('Call error:', err);
                    if (this.onCallError) this.onCallError(err);
                    this.endCall();
                });

                return true;
            } catch (error) {
                console.error('Failed to answer call:', error);
                if (this.onCallError) this.onCallError(error);
                return false;
            }
        }

        playRemoteStream(stream) {
            // Create or reuse audio element for remote stream
            let audioElement = document.getElementById('peerCallAudio');
            if (!audioElement) {
                audioElement = document.createElement('audio');
                audioElement.id = 'peerCallAudio';
                audioElement.autoplay = true;
                document.body.appendChild(audioElement);
            }
            audioElement.srcObject = stream;
            audioElement.play().catch(e => console.error('Audio play error:', e));
        }

        endCall() {
            if (this.currentCall) {
                this.currentCall.close();
                this.currentCall = null;
            }

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            if (this.remoteStream) {
                this.remoteStream.getTracks().forEach(track => track.stop());
                this.remoteStream = null;
            }

            const audioElement = document.getElementById('peerCallAudio');
            if (audioElement) {
                audioElement.srcObject = null;
            }

            this.stopCallTimer();
            const duration = this.callStartTime ? Math.floor((Date.now() - this.callStartTime) / 1000) : 0;

            if (this.isInCall && this.onCallEnd) {
                this.onCallEnd({ duration });
            }

            this.isInCall = false;
            this.callStartTime = null;
        }

        startCallTimer() {
            // Timer handled by UI
        }

        stopCallTimer() {
            if (this.callTimer) {
                clearInterval(this.callTimer);
                this.callTimer = null;
            }
        }

        getCallDuration() {
            if (!this.callStartTime) return 0;
            return Math.floor((Date.now() - this.callStartTime) / 1000);
        }

        getPeerId() {
            return this.peerId;
        }

        isCallActive() {
            return this.isInCall;
        }

        destroy() {
            this.endCall();
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
        }
    }

    // ============================================================================
    // SECTION 5: MAIN CALL CENTER MODULE - Central Controller
    // ============================================================================

    class CallCenterModule {
        constructor(containerSelector) {
            this.container = typeof containerSelector === 'string'
                ? document.querySelector(containerSelector)
                : containerSelector;

            this.database = new DatabaseManager();
            this.audioRecorder = null;
            this.transcriptionService = null;
            this.peerCallService = null;

            this.isInitialized = false;
            this.currentContact = { name: 'Unknown', id: null };

            this.ui = {
                videoCallBtn: null,
                audioCallBtn: null,
                syncContactsBtn: null,
                recordBtn: null,
                transcribeBtn: null,
                recordingStatus: null,
                recordingTimer: null,
                recentRecordingsList: null,
                videoCallDropdown: null
            };

            this.recordingFlashInterval = null;
            this.contacts = [];
            this.callTimerInterval = null;
        }

        async init(config = {}) {
            try {
                await this.database.init();
                console.log('Database initialized');

                this.audioRecorder = new AudioRecorder(this.database);
                this.setupRecorderCallbacks();
                console.log('Audio recorder initialized');

                this.transcriptionService = new TranscriptionService(this.database);
                this.setupTranscriptionCallbacks();
                console.log('Transcription service initialized');

                // Initialize PeerJS for WebRTC calling
                this.peerCallService = new PeerCallService();
                this.setupPeerCallCallbacks();
                try {
                    await this.peerCallService.init();
                    console.log('PeerJS WebRTC service initialized');
                } catch (err) {
                    console.warn('PeerJS initialization failed, falling back to external calls:', err);
                }

                this.bindUIElements();
                this.attachEventListeners();
                this.updateRecordingsList();

                // Load saved contacts
                this.contacts = await this.database.getAllContacts();

                this.isInitialized = true;
                console.log('Call Center Module fully initialized');

                return true;
            } catch (error) {
                console.error('Failed to initialize Call Center Module:', error);
                return false;
            }
        }

        setupPeerCallCallbacks() {
            this.peerCallService.onPeerIdReady = (peerId) => {
                console.log('Your Peer ID:', peerId);
                this.dispatchEvent('peerReady', { peerId });
            };

            this.peerCallService.onCallStart = (data) => {
                console.log('Call started:', data);
                this.updateCallUI(true);
                this.startCallTimerUI();
                this.dispatchEvent('callStart', data);
            };

            this.peerCallService.onCallEnd = (data) => {
                console.log('Call ended, duration:', data.duration);
                this.updateCallUI(false);
                this.stopCallTimerUI();
                this.database.saveCallHistory(this.currentContact.name || 'Unknown', 'audio', data.duration, 'peerjs');
                this.dispatchEvent('callEnd', data);
            };

            this.peerCallService.onCallError = (error) => {
                console.error('Call error:', error);
                this.updateCallUI(false);
                this.stopCallTimerUI();
                this.dispatchEvent('callError', { error });
            };

            this.peerCallService.onIncomingCall = (call) => {
                console.log('Incoming call from:', call.peer);
                // Auto-answer incoming calls
                this.peerCallService.answerCall(call);
            };
        }

        updateCallUI(isInCall) {
            if (this.ui.audioCallBtn) {
                if (isInCall) {
                    this.ui.audioCallBtn.classList.add('in-call');
                    this.ui.audioCallBtn.querySelector('.call-text').textContent = 'End Call';
                    this.ui.audioCallBtn.querySelector('.call-icon').textContent = '📵';
                } else {
                    this.ui.audioCallBtn.classList.remove('in-call');
                    this.ui.audioCallBtn.querySelector('.call-text').textContent = 'Audio Call';
                    this.ui.audioCallBtn.querySelector('.call-icon').textContent = '📞';
                }
            }
        }

        startCallTimerUI() {
            if (this.ui.recordingStatus) {
                this.ui.recordingStatus.style.display = 'block';
                this.ui.recordingStatus.querySelector('.recording-indicator').innerHTML = '<span class="recording-dot" style="background: #00ff41;"></span> Call in progress...';
            }
            this.callTimerInterval = setInterval(() => {
                const duration = this.peerCallService.getCallDuration();
                if (this.ui.recordingTimer) {
                    this.ui.recordingTimer.textContent = this.formatDuration(duration);
                }
            }, 1000);
        }

        stopCallTimerUI() {
            if (this.callTimerInterval) {
                clearInterval(this.callTimerInterval);
                this.callTimerInterval = null;
            }
            if (this.ui.recordingStatus) {
                this.ui.recordingStatus.style.display = 'none';
            }
            if (this.ui.recordingTimer) {
                this.ui.recordingTimer.textContent = '00:00';
            }
        }

        setupRecorderCallbacks() {
            this.audioRecorder.onRecordingStart = (data) => {
                console.log('Recording started:', data);
                this.updateRecordingUI(true);
                this.startRecordingFlash();
                this.dispatchEvent('recordingStart', data);

                // Start live transcription when recording starts
                if (this.transcriptionService) {
                    this.transcriptionService.startLiveTranscription();
                }
            };

            this.audioRecorder.onRecordingStop = async (data) => {
                console.log('Recording saved:', data);
                this.updateRecordingUI(false);
                this.stopRecordingFlash();
                this.updateRecordingsList();
                this.dispatchEvent('recordingStop', data);

                // Stop live transcription and get transcript
                let liveTranscript = '';
                if (this.transcriptionService) {
                    liveTranscript = this.transcriptionService.stopLiveTranscription();
                }

                // Save live transcript with the recording
                if (liveTranscript && data.id) {
                    try {
                        await this.database.updateRecordingTranscript(data.id, liveTranscript);
                        console.log('Live transcript saved with recording');
                    } catch (e) {
                        console.warn('Could not save live transcript:', e);
                    }
                }

                // Save to file system as well
                this.saveRecordingToFiles(data);
            };

            this.audioRecorder.onError = (error) => {
                console.error('Recording error:', error);
                this.updateRecordingUI(false);
                this.stopRecordingFlash();
                this.dispatchEvent('recordingError', { error });

                // Stop transcription on error
                if (this.transcriptionService) {
                    this.transcriptionService.stopLiveTranscription();
                }
            };
        }

        async saveRecordingToFiles(data) {
            // Save recording to Transcriptions folder
            if (window.electronAPI?.saveFile && data.blob) {
                try {
                    const reader = new FileReader();
                    reader.onload = async () => {
                        await window.electronAPI.saveFile({
                            ownerType: 'transcription',
                            ownerId: 'audio-recordings',
                            ownerName: 'Audio Recordings',
                            fileName: data.fileName,
                            fileData: reader.result,
                            fileType: data.blob.type,
                            fileSize: data.blob.size
                        });
                        console.log('Recording saved to files:', data.fileName);
                    };
                    reader.readAsDataURL(data.blob);
                } catch (error) {
                    console.error('Error saving recording to files:', error);
                }
            }
        }

        setupTranscriptionCallbacks() {
            this.transcriptionService.onTranscriptionStart = (data) => {
                console.log('Transcription started:', data);
                this.dispatchEvent('transcriptionStart', data);
            };

            this.transcriptionService.onTranscriptionComplete = async (data) => {
                console.log('Transcription complete:', data);
                this.dispatchEvent('transcriptionComplete', data);

                // Save transcription to files
                if (window.electronAPI?.saveFile) {
                    try {
                        const textBlob = new Blob([data.text], { type: 'text/plain' });
                        const reader = new FileReader();
                        reader.onload = async () => {
                            await window.electronAPI.saveFile({
                                ownerType: 'transcription',
                                ownerId: 'transcripts',
                                ownerName: 'Text Transcripts',
                                fileName: data.fileName,
                                fileData: reader.result,
                                fileType: 'text/plain',
                                fileSize: textBlob.size
                            });
                        };
                        reader.readAsDataURL(textBlob);
                    } catch (error) {
                        console.error('Error saving transcription:', error);
                    }
                }

            };

            this.transcriptionService.onTranscriptionError = (error) => {
                console.error('Transcription error:', error);
                this.dispatchEvent('transcriptionError', { error });
            };
        }

        bindUIElements() {
            this.ui.videoCallBtn = document.getElementById('startVideoCall');
            this.ui.audioCallBtn = document.getElementById('startAudioCall');
            this.ui.syncContactsBtn = document.getElementById('syncContactsBtn');
            this.ui.recordBtn = document.getElementById('recordBtn');
            this.ui.transcribeBtn = document.getElementById('transcribeBtn');
            this.ui.recordingStatus = document.getElementById('recordingStatus');
            this.ui.recordingTimer = document.getElementById('recordingTimer');
            this.ui.recentRecordingsList = document.getElementById('recentRecordingsList');
            this.ui.videoCallDropdown = document.getElementById('videoCallDropdown');
        }

        attachEventListeners() {
            // Audio Call Button - Open Zoom
            if (this.ui.audioCallBtn) {
                this.ui.audioCallBtn.addEventListener('click', () => this.handleAudioCallClick());
            }

            // Sync Contacts Button
            if (this.ui.syncContactsBtn) {
                this.ui.syncContactsBtn.addEventListener('click', () => this.handleSyncContacts());
            }

            // Record Button
            if (this.ui.recordBtn) {
                this.ui.recordBtn.addEventListener('click', () => this.handleRecordClick());
            }

            // Transcribe Button
            if (this.ui.transcribeBtn) {
                this.ui.transcribeBtn.addEventListener('click', () => this.handleTranscribeClick());
            }
        }

        toggleVideoCallDropdown() {
            if (this.ui.videoCallDropdown) {
                this.ui.videoCallDropdown.classList.toggle('active');
            }
        }

        hideVideoCallDropdown() {
            if (this.ui.videoCallDropdown) {
                this.ui.videoCallDropdown.classList.remove('active');
            }
        }

        handleVideoCallPlatform(platform) {
            // Use app protocols to open desktop apps
            const urls = {
                zoom: 'zoommtg://zoom.us/start?confno=new',
                teams: 'msteams://teams.microsoft.com/l/meeting/new',
                meet: 'https://meet.google.com/new'
            };

            const url = urls[platform];
            if (url) {
                if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal(url);
                } else {
                    window.open(url, '_blank');
                }

                // Log the call
                this.database.saveCallHistory('Video Call', 'video', 0, platform);
            }
        }

        handleAudioCallClick() {
            console.log('CallCenterModule: handleAudioCallClick called');
            // Open Zoom app directly
            const zoomUrl = 'zoommtg://zoom.us/start?confno=new';
            console.log('CallCenterModule: Opening Zoom app:', zoomUrl);
            if (window.electronAPI?.openExternal) {
                window.electronAPI.openExternal(zoomUrl);
            } else {
                window.open(zoomUrl, '_blank');
            }
            this.database.saveCallHistory('Audio Call', 'audio', 0, 'zoom');
        }

        // Method to start a call to a specific contact (for use from profile cards)
        async startCallToContact(contactName, contactPhone) {
            this.setCurrentContact(contactName);
            // Open Zoom audio call
            this.handleAudioCallClick();
        }

        async handleSyncContacts() {
            if (this.ui.syncContactsBtn) {
                this.ui.syncContactsBtn.textContent = 'SYNCING...';
                this.ui.syncContactsBtn.disabled = true;
            }

            try {
                const response = await fetch('http://localhost:3001/api/contacts');
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to sync contacts');
                }

                // Clear existing contacts and save new ones
                await this.database.clearContacts();

                for (const contact of data.contacts) {
                    await this.database.saveContact(contact);
                }

                this.contacts = await this.database.getAllContacts();
                console.log(`Synced ${data.contacts.length} contacts`);

            } catch (error) {
                console.error('Contact sync error:', error);
            } finally {
                if (this.ui.syncContactsBtn) {
                    this.ui.syncContactsBtn.textContent = 'SYNC CONTACTS';
                    this.ui.syncContactsBtn.disabled = false;
                }
            }
        }

        async handleRecordClick() {
            const recorderState = this.audioRecorder.getRecordingState();

            if (recorderState.isRecording) {
                // Stop recording
                this.audioRecorder.stopRecording();
            } else {
                // Start recording - use current contact or prompt
                const contactName = this.currentContact.name !== 'Unknown'
                    ? this.currentContact.name
                    : 'Call Recording';
                await this.audioRecorder.startRecording(contactName);
            }
        }

        startRecordingFlash() {
            if (this.ui.recordBtn) {
                this.recordingFlashInterval = setInterval(() => {
                    this.ui.recordBtn.classList.toggle('flash-red');
                }, 500);
            }
        }

        stopRecordingFlash() {
            if (this.recordingFlashInterval) {
                clearInterval(this.recordingFlashInterval);
                this.recordingFlashInterval = null;
            }
            if (this.ui.recordBtn) {
                this.ui.recordBtn.classList.remove('flash-red');
            }
        }

        async handleTranscribeClick() {
            const recordings = await this.database.getAllAudioRecordings();

            if (recordings.length === 0) {
                console.log('No recordings available to transcribe');
                return;
            }

            this.openTranscribeModal(recordings);
        }

        openTranscribeModal(recordings) {
            // Use existing modal from HTML
            const modal = document.getElementById('transcribeModal');
            if (!modal) {
                console.error('Transcribe modal not found in HTML');
                return;
            }

            // Setup event listeners if not already done
            if (!this.transcribeModalInitialized) {
                const closeBtn = document.getElementById('closeTranscribeModal');
                const startBtn = document.getElementById('startTranscribeBtn');

                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.closeTranscribeModal());
                }
                if (startBtn) {
                    startBtn.addEventListener('click', () => this.transcribeSelectedRecording());
                }

                // Close on overlay click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) this.closeTranscribeModal();
                });

                this.transcribeModalInitialized = true;
            }

            const listContainer = document.getElementById('recordingsListModal');
            if (listContainer) {
                listContainer.innerHTML = recordings.map(rec => `
                    <div class="recording-select-item ${rec.transcribed ? 'transcribed' : ''}" data-recording-id="${rec.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid rgba(0,255,65,0.3); margin-bottom: 8px; cursor: pointer; transition: all 0.2s;">
                        <div style="flex: 1;">
                            <div style="color: #00ff41; font-size: 14px; font-family: 'VT323', monospace;">${this.escapeHtml(rec.fileName || rec.contactName)}</div>
                            <div style="color: #00cc33; font-size: 12px; margin-top: 4px;">
                                Duration: ${this.formatDuration(rec.duration)} | ${rec.liveTranscript ? '✓ Has transcript' : 'Not transcribed'}
                            </div>
                        </div>
                        <div style="color: #00cc33; font-size: 12px;">${new Date(rec.date).toLocaleDateString()}</div>
                    </div>
                `).join('');

                if (recordings.length === 0) {
                    listContainer.innerHTML = '<div class="no-recordings-message" style="color: #00cc33; padding: 20px; text-align: center;">No recordings available. Record some audio first.</div>';
                }

                listContainer.querySelectorAll('.recording-select-item').forEach(item => {
                    item.addEventListener('click', () => {
                        listContainer.querySelectorAll('.recording-select-item').forEach(i => {
                            i.classList.remove('selected');
                            i.style.background = '';
                            i.style.borderColor = 'rgba(0,255,65,0.3)';
                        });
                        item.classList.add('selected');
                        item.style.background = 'rgba(0,255,65,0.2)';
                        item.style.borderColor = '#00ff41';
                        this.selectedRecording = parseInt(item.dataset.recordingId);
                        const startBtn = document.getElementById('startTranscribeBtn');
                        if (startBtn) startBtn.disabled = false;
                    });
                });
            }

            // Reset transcription result area
            const transcriptionResult = document.getElementById('transcriptionResult');
            if (transcriptionResult) transcriptionResult.style.display = 'none';

            // Reset start button
            const startBtn = document.getElementById('startTranscribeBtn');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = 'Start Transcription';
            }

            modal.classList.add('active');
        }

        async transcribeSelectedRecording() {
            if (!this.selectedRecording) return;

            const startBtn = document.getElementById('startTranscribeBtn');
            const transcriptionResult = document.getElementById('transcriptionResult');
            const transcriptionText = document.getElementById('transcriptionText');

            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = 'Transcribing...';
            }

            try {
                const result = await this.transcriptionService.transcribeAudioFile(this.selectedRecording);

                // Show transcription result in the modal
                if (transcriptionResult && transcriptionText && result) {
                    transcriptionText.textContent = result.transcriptionText || result.text || 'Transcription complete';
                    transcriptionResult.style.display = 'block';
                }

                if (startBtn) {
                    startBtn.textContent = 'Done!';
                    setTimeout(() => {
                        startBtn.textContent = 'Start Transcription';
                        startBtn.disabled = true;
                    }, 2000);
                }
            } catch (error) {
                console.error('Transcription failed:', error);
                if (startBtn) {
                    startBtn.textContent = 'Failed - Try Again';
                    startBtn.disabled = false;
                }
            }
        }

        closeTranscribeModal() {
            const modal = document.getElementById('transcribeModal');
            if (modal) {
                modal.classList.remove('active');
            }
            this.selectedRecording = null;
        }

        async updateRecordingsList() {
            if (!this.ui.recentRecordingsList) return;

            const recordings = await this.database.getAllAudioRecordings();
            const recentRecordings = recordings.slice(-5).reverse();

            if (recentRecordings.length === 0) {
                this.ui.recentRecordingsList.innerHTML = '<div class="no-recordings-message" style="color: #00cc33; padding: 10px; text-align: center;">No recordings yet. Click Record to start.</div>';
                return;
            }

            this.ui.recentRecordingsList.innerHTML = recentRecordings.map(rec => `
                <div class="recording-item" data-recording-id="${rec.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid rgba(0,255,65,0.1);">
                    <span class="recording-name" style="color: #00ff41; flex: 1; font-size: 12px;">${this.escapeHtml(rec.contactName)}</span>
                    <span class="recording-duration" style="color: #00cc33; margin: 0 10px; font-size: 12px;">${this.formatDuration(rec.duration)}</span>
                    <div class="recording-actions" style="display: flex; gap: 5px;">
                        <button class="recording-action-btn play-btn" data-action="play" data-id="${rec.id}" style="background: none; border: 1px solid #00ff41; color: #00ff41; padding: 2px 8px; cursor: pointer; font-size: 12px;">▶</button>
                        <button class="recording-action-btn delete-btn" data-action="delete" data-id="${rec.id}" style="background: none; border: 1px solid #ff4444; color: #ff4444; padding: 2px 8px; cursor: pointer; font-size: 12px;">✕</button>
                    </div>
                </div>
            `).join('');

            this.ui.recentRecordingsList.querySelectorAll('.recording-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const id = parseInt(btn.dataset.id);

                    if (action === 'play') {
                        await this.playRecording(id);
                    } else if (action === 'delete') {
                        await this.deleteRecording(id);
                    }
                });
            });
        }

        async playRecording(id) {
            const recording = await this.database.getAudioRecording(id);
            if (!recording) return;

            const audioBlob = new Blob([recording.audioData], { type: recording.mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();

            audio.onended = () => URL.revokeObjectURL(audioUrl);
        }

        async deleteRecording(id) {
            await this.database.deleteAudioRecording(id);
            this.updateRecordingsList();
        }

        updateRecordingUI(isRecording) {
            const recordIcon = document.getElementById('recordIcon');
            const recordText = document.getElementById('recordText');

            if (isRecording) {
                if (this.ui.recordBtn) this.ui.recordBtn.classList.add('recording');
                if (recordIcon) recordIcon.textContent = '⏹️';
                if (recordText) recordText.textContent = 'Stop';
                if (this.ui.recordingStatus) this.ui.recordingStatus.style.display = 'block';
                this.startRecordingTimer();
            } else {
                if (this.ui.recordBtn) this.ui.recordBtn.classList.remove('recording');
                if (recordIcon) recordIcon.textContent = '⏺️';
                if (recordText) recordText.textContent = 'Record';
                if (this.ui.recordingStatus) this.ui.recordingStatus.style.display = 'none';
                this.stopRecordingTimer();
            }
        }

        startRecordingTimer() {
            if (this.recordingTimerInterval) return;

            this.recordingTimerInterval = setInterval(() => {
                const state = this.audioRecorder.getRecordingState();
                if (this.ui.recordingTimer) {
                    this.ui.recordingTimer.textContent = this.formatDuration(state.elapsedTime);
                }
            }, 1000);
        }

        stopRecordingTimer() {
            if (this.recordingTimerInterval) {
                clearInterval(this.recordingTimerInterval);
                this.recordingTimerInterval = null;
            }
            if (this.ui.recordingTimer) {
                this.ui.recordingTimer.textContent = '00:00';
            }
        }

        formatDuration(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        setCurrentContact(name, id = null) {
            this.currentContact = { name, id };
        }

        getRecordingState() {
            return this.audioRecorder?.getRecordingState() || { isRecording: false };
        }

        async getAllRecordings() {
            return this.database.getAllAudioRecordings();
        }

        async getAllTranscriptions() {
            return this.database.getAllTranscriptions();
        }

        getContacts() {
            return this.contacts;
        }

        dispatchEvent(eventName, detail) {
            const event = new CustomEvent(`callcenter:${eventName}`, { detail });
            window.dispatchEvent(event);
            if (this.container) {
                this.container.dispatchEvent(event);
            }
        }

        destroy() {
            this.stopRecordingTimer();
            this.stopRecordingFlash();
            this.stopCallTimerUI();

            if (this.audioRecorder) {
                this.audioRecorder.destroy();
            }

            if (this.peerCallService) {
                this.peerCallService.destroy();
            }

            this.isInitialized = false;
        }

        // Expose PeerJS call service for external use
        getPeerCallService() {
            return this.peerCallService;
        }
    }

    // ============================================================================
    // EXPORT & GLOBAL REGISTRATION
    // ============================================================================

    const moduleInstance = {
        CallCenterModule: CallCenterModule,
        DatabaseManager: DatabaseManager,
        AudioRecorder: AudioRecorder,
        TranscriptionService: TranscriptionService,
        PeerCallService: PeerCallService,

        instance: null,

        async create(containerSelector, config = {}) {
            this.instance = new CallCenterModule(containerSelector);
            await this.instance.init(config);
            return this.instance;
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = moduleInstance;
    } else if (typeof define === 'function' && define.amd) {
        define([], function() { return moduleInstance; });
    } else {
        global.CallCenterModule = moduleInstance;
    }

})(typeof window !== 'undefined' ? window : this);

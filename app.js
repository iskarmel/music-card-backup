document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const form = document.getElementById('creation-form');
    const loadingState = document.getElementById('loading-state');
    const resultView = document.getElementById('result-view');

    // Form Inputs
    const recipientInput = document.getElementById('recipient-name');
    const occasionInput = document.getElementById('occasion');

    // Catalog Data (will be fetched from Supabase)
    let TRACK_CATALOG = [];

    let selectedTrackId = null;

    // Audio Elements
    const audioSourceRadios = document.querySelectorAll('input[name="audio-source"]');
    const audioCatalogWrapper = document.getElementById('audio-catalog-wrapper');
    const trackCatalogContainer = document.getElementById('track-catalog');
    const audioUploadWrapper = document.getElementById('audio-upload-wrapper');
    const audioLinkWrapper = document.getElementById('audio-link-wrapper');
    const audioFileInput = document.getElementById('audio-file');
    const uploadFilename = document.getElementById('upload-filename');
    const audioLinkInput = document.getElementById('audio-link');
    const audioGeminiWrapper = document.getElementById('audio-gemini-wrapper');
    const audioGeminiInput = document.getElementById('audio-gemini-file');
    const uploadGeminiFilename = document.getElementById('upload-gemini-filename');
    const lyricsSection = document.getElementById('lyrics-section');

    const dictationInput = document.getElementById('dictation');
    const dictationLabel = document.getElementById('dictation-label');
    const dictationHelper = document.getElementById('dictation-helper');
    const modeRadios = document.querySelectorAll('input[name="generation-mode"]');

    // Mic Elements
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');

    // Result Elements
    const resName = document.getElementById('res-name');
    const resOccasion = document.getElementById('res-occasion');
    const songLyrics = document.getElementById('song-lyrics');
    const playingMelodyName = document.getElementById('playing-melody-name');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = playPauseBtn.querySelector('i');
    const createNewBtn = document.getElementById('create-new-btn');

    // Action Buttons
    const shareBtn = document.getElementById('share-btn');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const cardToDownload = document.getElementById('card-to-download');
    const voiceBtn = document.getElementById('voice-btn');
    const voiceSelect = document.getElementById('voice-select');

    // Social Panel
    const socialPanel = document.getElementById('social-panel');
    const shareTg = document.getElementById('share-tg');
    const shareWa = document.getElementById('share-wa');
    const shareVb = document.getElementById('share-vb');
    const shareCopy = document.getElementById('share-copy');

    // Audio Player
    const bgAudio = document.getElementById('bg-audio');
    const voiceAudio = document.getElementById('voice-audio');
    const visualizer = document.getElementById('visualizer');
    const canvasCtx = visualizer.getContext('2d');

    // --- State ---
    let isRecording = false;
    let recognition = null;
    let isPlaying = false;
    let currentAudioUrl = '';
    let originalAudioUrl = ''; // Keep track of the unmixed background
    let currentCardId = null; // Store the ID if this card was loaded or already saved
    let previewAudio = null;
    let isReceivedCard = false; // Flag to identify if the user is viewing a card they didn't create

    // --- Render Track Catalog ---
    const renderTrackCatalog = async () => {
        const isAdvanced = window.location.pathname.includes('advanced.html');
        const url = isAdvanced ? '/api/beats?includeHidden=true' : '/api/beats';

        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                TRACK_CATALOG = data.sort((a, b) => (b.uses_count || 0) - (a.uses_count || 0));
            }
        } catch (e) {
            console.error("Error fetching catalog:", e);
        }

        const mainContainer = document.getElementById('track-catalog');
        const adminContainer = document.getElementById('admin-track-list');
        const allContainers = [mainContainer, adminContainer].filter(c => c);

        allContainers.forEach(container => {
            container.innerHTML = '';
            const isMain = container.id === 'track-catalog';

            TRACK_CATALOG.forEach(track => {
                const trackItem = document.createElement('div');
                trackItem.className = `track-item ${track.is_hidden ? 'is-hidden-track' : ''}`;
                trackItem.dataset.id = track.id;

                trackItem.innerHTML = `
                    <i class="ph ${track.icon} track-icon"></i>
                    <div style="flex: 1; min-width: 0;">
                        <span class="track-title">${track.title} ${track.is_hidden ? '<span class="hidden-badge">СКРЫТ</span>' : ''}</span>
                        <span class="track-genre">${track.genre} ${track.uses_count ? `(🔥 ${track.uses_count})` : ''}</span>
                    </div>
                    <button class="track-play-preview" aria-label="Preview" data-url="${track.url}">
                        <i class="ph-bold ph-play"></i> Слушать
                    </button>
                    ${isAdvanced ? `
                    <button class="track-toggle-visibility ${track.is_hidden ? 'is-hidden' : ''}" data-id="${track.id}">
                        <i class="ph-bold ${track.is_hidden ? 'ph-eye' : 'ph-eye-slash'}"></i> ${track.is_hidden ? 'Показать' : 'Скрыть'}
                    </button>` : ''}
                `;

                // Selection Logic (Creation Form only)
                if (isMain) {
                    trackItem.addEventListener('click', (e) => {
                        if (e.target.closest('.track-play-preview')) return;
                        if (e.target.closest('.track-toggle-visibility')) return;

                        mainContainer.querySelectorAll('.track-item').forEach(el => el.classList.remove('selected'));
                        trackItem.classList.add('selected');
                        selectedTrackId = track.id;
                    });
                }

                // Preview Play Logic
                const previewBtn = trackItem.querySelector('.track-play-preview');
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (previewAudio && previewAudio.src === track.url && !previewAudio.paused) {
                        previewAudio.pause();
                        trackItem.classList.remove('playing');
                        previewBtn.innerHTML = '<i class="ph-bold ph-play"></i> Слушать';
                    } else {
                        if (previewAudio) {
                            previewAudio.pause();
                            document.querySelectorAll('.track-item').forEach(el => {
                                el.classList.remove('playing');
                                const b = el.querySelector('.track-play-preview');
                                if (b) b.innerHTML = '<i class="ph-bold ph-play"></i> Слушать';
                            });
                        }
                        previewAudio = new Audio(track.url);
                        previewAudio.volume = 0.2;
                        previewAudio.play();
                        trackItem.classList.add('playing');
                        previewBtn.innerHTML = '<i class="ph-bold ph-stop"></i> Стоп';
                        previewAudio.addEventListener('ended', () => {
                            trackItem.classList.remove('playing');
                            previewBtn.innerHTML = '<i class="ph-bold ph-play"></i> Слушать';
                        });
                    }
                });

                // Visibility Toggle
                if (isAdvanced) {
                    const toggleBtn = trackItem.querySelector('.track-toggle-visibility');
                    if (toggleBtn) {
                        toggleBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            toggleBtn.disabled = true;
                            toggleBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i>';
                            try {
                                const res = await fetch(`/api/beats/${track.id}/toggle-visibility`, { method: 'POST' });
                                if (res.ok) {
                                    renderTrackCatalog();
                                }
                            } catch (err) {
                                console.error('Toggle failed:', err);
                            } finally {
                                toggleBtn.disabled = false;
                            }
                        });
                    }
                }

                container.appendChild(trackItem);
            });

            // Default selection
            if (isMain && !selectedTrackId) {
                const first = container.querySelector('.track-item');
                if (first) first.click();
            }
        });
    };

    // Initialize catalog UI
    renderTrackCatalog();

    // --- Audio Context and Visualizer ---
    let audioCtx;
    let analyser;
    let source;
    let dataArray;
    let bufferLength;
    let visualizerAnimationId;

    // --- Audio Helpers ---
    const fadeAudio = (audioElement, targetVolume, duration) => {
        const step = 50; // ms
        const volumeStep = (targetVolume - audioElement.volume) / (duration / step);
        const interval = setInterval(() => {
            let newVolume = audioElement.volume + volumeStep;
            if ((volumeStep > 0 && newVolume >= targetVolume) || (volumeStep < 0 && newVolume <= targetVolume)) {
                audioElement.volume = targetVolume;
                clearInterval(interval);
            } else {
                audioElement.volume = newVolume;
            }
        }, step);
    };

    const initAudioContext = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();

            // CORS settings for background audio
            bgAudio.crossOrigin = "anonymous";
            voiceAudio.crossOrigin = "anonymous";

            // iOS Safari has severe bugs with Web Audio API and cross-origin media streams.
            // Routing them through standard MediaElementSource often results in silence or static.
            // So on iOS, we skip the Web Audio routing entirely and let the visualizer stay flat,
            // while the audio plays normally through the native HTML5 elements.
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            if (!isIOS) {
                try {
                    source = audioCtx.createMediaElementSource(bgAudio);
                    source.connect(analyser);
                    analyser.connect(audioCtx.destination);
                } catch (e) {
                    console.warn("Could not connect audio sources to analyser (likely already connected):", e);
                }
            }

            analyser.fftSize = 64;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }
    };

    const drawVisualizer = () => {
        visualizerAnimationId = requestAnimationFrame(drawVisualizer);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);

        const barWidth = (visualizer.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 255 * visualizer.height;
            canvasCtx.fillStyle = `rgb(139, 92, 246)`; // primary color
            canvasCtx.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };

    // --- Web Speech API Setup ---
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ru-RU'; // Set to Russian

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micStatus.classList.remove('hidden');
            micStatus.textContent = 'Слушаю... (Нажмите еще раз, чтобы остановить)';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append final and show interim
            if (finalTranscript) {
                const currentVal = dictationInput.value;
                const prefix = currentVal && !currentVal.endsWith(' ') ? currentVal + ' ' : currentVal;
                dictationInput.value = prefix + finalTranscript;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                micStatus.textContent = 'Доступ к микрофону заблокирован браузером. Пожалуйста, введите текст вручную.';
            } else {
                micStatus.textContent = `Ошибка микрофона (${event.error}).`;
            }
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };
    } else {
        micBtn.style.display = 'none';
        micStatus.classList.remove('hidden');
        micStatus.textContent = 'Голосовой ввод не поддерживается вашим браузером.';
    }

    // --- Mode Toggle Logic ---
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isManual = e.target.value === 'manual';
            if (isManual) {
                dictationLabel.innerHTML = 'Ваш готовый текст';
                dictationHelper.textContent = 'Напишите или вставьте готовый стих. ИИ просто красиво его прочитает.';
                dictationInput.placeholder = 'Вставьте ваш текст...';
                micBtn.style.display = 'none';
                if (isRecording) stopRecording();
            } else {
                dictationLabel.innerHTML = 'Что пожелать? <span id="mic-badge" class="badge">Голосовой ввод</span>';
                dictationHelper.textContent = 'Надиктуйте суть поздравления, а ИИ превратит это в красивую песню.';
                dictationInput.placeholder = 'Скажите что-нибудь теплое...';
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    micBtn.style.display = 'flex';
                }
            }
        });
    });

    // --- Audio Source Toggle Logic ---
    audioSourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const source = e.target.value;
            audioCatalogWrapper.classList.add('hidden');
            audioUploadWrapper.classList.add('hidden');
            audioLinkWrapper.classList.add('hidden');
            audioGeminiWrapper.classList.add('hidden');

            // Show/hide lyrics dictation section based on if it's a Gemini track
            if (source === 'gemini') {
                lyricsSection.classList.add('hidden');
                dictationInput.removeAttribute('required');
            } else {
                lyricsSection.classList.remove('hidden');
                dictationInput.setAttribute('required', 'required');
            }

            if (source === 'catalog') {
                audioCatalogWrapper.classList.remove('hidden');
            } else if (source === 'upload') {
                audioUploadWrapper.classList.remove('hidden');
            } else if (source === 'link') {
                audioLinkWrapper.classList.remove('hidden');
            } else if (source === 'gemini') {
                audioGeminiWrapper.classList.remove('hidden');
            }
        });
    });

    audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadFilename.textContent = file.name;
            uploadFilename.style.color = '#fff';
        } else {
            uploadFilename.innerHTML = 'Нажмите, чтобы выбрать .mp3 файл<br><small>(до 15 МБ)</small>';
            uploadFilename.style.color = '';
        }
    });

    audioGeminiInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadGeminiFilename.textContent = file.name;
            uploadGeminiFilename.style.color = '#fff';
        } else {
            uploadGeminiFilename.innerHTML = 'Нажмите, чтобы выбрать готовый трек<br><small>(до 15 МБ)</small>';
            uploadGeminiFilename.style.color = '';
        }
    });

    const uploadAudioFile = async (file) => {
        const formData = new FormData();
        formData.append('audio', file);

        try {
            const response = await fetch('/api/upload-audio', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Ошибка загрузки аудио на сервер');
            }
            const data = await response.json();
            return data.url;
        } catch (e) {
            console.error('Audio upload failed:', e);
            throw e;
        }
    };

    const startRecording = () => {
        if (recognition) {
            try {
                recognition.start();
            } catch (e) {
                console.warn(e);
            }
        }
    };

    const stopRecording = () => {
        if (recognition && isRecording) {
            recognition.stop();
        }
        isRecording = false;
        micBtn.classList.remove('recording');
        micStatus.classList.add('hidden');
    };

    micBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // --- Real AI Generation (Backend API) ---
    const generateSongVerse = async (name, occasion, prompt, mood) => {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, occasion, prompt, mood })
            });

            if (!response.ok) {
                throw new Error('Ой, что-то пошло не так на сервере.');
            }

            const data = await response.json();
            return data.lyrics;
        } catch (error) {
            console.error('Error fetching lyrics:', error);
            alert('Не удалось связаться с сервером ИИ. Серверу может потребоваться до 50 секунд для выхода из спящего режима на бесплатном тарифе, подождите немного и попробуйте снова.');
            return 'К сожалению, не удалось связаться с ИИ. Пожалуйста, подождите немного, пока сервер запустится.';
        }
    };

    // --- Form Submission Logic ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Stop dictation just in case it's still running
        stopRecording();

        const name = recipientInput.value.trim();
        const occasion = occasionInput.value.trim();
        const dictation = dictationInput.value.trim();

        const audioSource = document.querySelector('input[name="audio-source"]:checked').value;
        let audioUrl = '';
        let melodyText = '';
        let style = '';

        if (audioSource === 'catalog') {
            const track = TRACK_CATALOG.find(t => t.id === selectedTrackId);
            if (!track) {
                alert('Пожалуйста, выберите минусовку из каталога');
                return;
            }
            audioUrl = track.url;
            melodyText = track.title;
            style = track.style;
        } else if (audioSource === 'link') {
            audioUrl = audioLinkInput.value.trim();
            melodyText = 'Пользовательский трек (Ссылка)';
            style = 'Нейтральный стиль';
            if (!audioUrl) {
                alert('Пожалуйста, вставьте ссылку на аудио-файл');
                return;
            }
        } else if (audioSource === 'upload') {
            const file = audioFileInput.files[0];
            if (!file) {
                alert('Пожалуйста, выберите аудио-файл для загрузки');
                return;
            }
            melodyText = file.name;
            style = 'Нейтральный стиль';
            audioUrl = 'pending_upload';
        } else if (audioSource === 'gemini') {
            const file = audioGeminiInput.files[0];
            if (!file) {
                alert('Пожалуйста, выберите готовый трек из Gemini/Suno');
                return;
            }
            melodyText = file.name;
            style = 'Свой трек';
            audioUrl = 'pending_gemini_upload';
        }

        if (!name || !occasion) return;
        if (audioSource !== 'gemini' && !dictation) return;

        // 1. Hide form, show loading
        form.classList.add('hidden');
        loadingState.classList.remove('hidden');

        try {
            if (audioSource === 'upload') {
                const loadingText = loadingState.querySelector('.loader-text');
                const origText = loadingText.textContent;
                loadingText.textContent = 'Загружаем аудиофайл в облако...';
                audioUrl = await uploadAudioFile(audioFileInput.files[0]);
                loadingText.textContent = origText;
            } else if (audioSource === 'gemini') {
                const loadingText = loadingState.querySelector('.loader-text');
                const origText = loadingText.textContent;
                loadingText.textContent = 'Загружаем ваш готовый трек...';
                audioUrl = await uploadAudioFile(audioGeminiInput.files[0]);
                loadingText.textContent = origText;
            }
        } catch (e) {
            alert('Ошибка загрузки файла: ' + e.message);
            loadingState.classList.add('hidden');
            form.classList.remove('hidden');
            return;
        }

        // 2. Generate or use manual content
        const generationMode = document.querySelector('input[name="generation-mode"]:checked').value;

        let generatedLyrics = '';
        if (audioSource === 'gemini') {
            generatedLyrics = '🎵 Текст встроен в композицию';
        } else if (generationMode === 'manual') {
            // Fake loading state slightly so it feels like it's processing
            await new Promise(r => setTimeout(r, 800));
            generatedLyrics = dictation;
        } else {
            generatedLyrics = await generateSongVerse(name, occasion, dictation, style);
        }

        currentAudioUrl = audioUrl;
        originalAudioUrl = audioUrl; // Save the original to prevent layering on regenerate

        // 3. Prepare Audio (via proxy to bypass strict CORS for visualizer)
        bgAudio.src = `/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
        bgAudio.volume = audioSource === 'gemini' ? 1.0 : 0.2; // Set low volume for the unmixed background preview, but full volume for ready Gemini tracks
        bgAudio.load();

        // 4. Update UI
        resName.textContent = name;
        resOccasion.textContent = occasion;
        songLyrics.textContent = generatedLyrics;
        playingMelodyName.textContent = melodyText;

        // 5. Hide loading, show result
        loadingState.classList.add('hidden');
        resultView.classList.remove('hidden');

        // Make sure to hide AI Voice elements if this was a Gemini mix
        const voiceControls = document.querySelector('.voice-controls');
        if (audioSource === 'gemini') {
            songLyrics.classList.add('hidden');
            copyTextBtn.classList.add('hidden');
            if (voiceControls) voiceControls.style.display = 'none';
        } else {
            songLyrics.classList.remove('hidden');
            copyTextBtn.classList.remove('hidden');
            if (voiceControls) voiceControls.style.display = 'flex';
        }

        // Clear current card ID for new generations
        currentCardId = null;

        // Play audio automatically if possible (browsers might block autoplay, so we handle the promise)
        initAudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        bgAudio.play().then(() => {
            isPlaying = true;
            playIcon.classList.replace('ph-play', 'ph-pause');
            drawVisualizer();
        }).catch((err) => {
            console.log('Autoplay prevented by browser', err);
            isPlaying = false;
            playIcon.classList.replace('ph-pause', 'ph-play');
        });
    });

    // --- Unified Audio Player Controls ---
    const togglePlay = async (forcePlay = false) => {
        if (isPlaying && !forcePlay) {
            bgAudio.pause();
            playIcon.classList.replace('ph-pause', 'ph-play');
            playPauseBtn.classList.remove('pulse-glow');
            isPlaying = false;
            cancelAnimationFrame(visualizerAnimationId);
            canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);
        } else if (!isPlaying || forcePlay) {
            initAudioContext();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            try {
                // On iOS, changing the src of an audio tag that was already routed through 
                // AudioContext can sometimes cause duplicate phantom audio layers.
                // Re-loading carefully before play.
                bgAudio.load();

                // Small delay for iOS to properly buffer the new src before blindly playing
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                if (isIOS) {
                    await new Promise(res => setTimeout(res, 200));
                }

                await bgAudio.play();
                playIcon.classList.replace('ph-play', 'ph-pause');
                playPauseBtn.classList.add('pulse-glow');
                isPlaying = true;
                drawVisualizer();
            } catch (err) {
                console.error("Playback failed (invalid URL or blocked):", err);
                playIcon.classList.replace('ph-pause', 'ph-play');
                playPauseBtn.classList.remove('pulse-glow');
                isPlaying = false;
            }
        }
    };

    playPauseBtn.addEventListener('click', () => togglePlay());

    // --- Share & Download Logic ---
    shareBtn.addEventListener('click', () => {
        if (navigator.share && /mobile/i.test(navigator.userAgent)) {
            // Use native share on mobile if available
            try {
                navigator.share({
                    title: 'Музыкальная Открытка',
                    text: `Посмотри, какую песню-поздравление я создал для ${resName.textContent}!\n\n${songLyrics.innerText}`
                });
            } catch (err) {
                console.log('Share failed:', err);
            }
        } else {
            // Toggle custom social panel on desktop or if share fails
            socialPanel.classList.toggle('hidden');
        }
    });

    const getShareUrl = async () => {
        if (currentCardId) {
            const baseUrl = window.location.href.split('?')[0].split('#')[0];
            return `${baseUrl}?id=${currentCardId}`;
        }

        const data = {
            name: resName.textContent,
            occasion: resOccasion.textContent,
            lyrics: songLyrics.innerText,
            audioUrl: currentAudioUrl,
            melodyText: playingMelodyName.textContent
        };

        try {
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error("Server returned " + response.status);
            }
            const result = await response.json();
            currentCardId = result.id;

            // Immediately track beat usage if creating from catalog
            const audioSourceStr = document.querySelector('input[name="audio-source"]:checked').value;
            if (audioSourceStr === 'catalog') {
                fetch(`/api/beats/${selectedTrackId}/use`, { method: 'POST' }).catch(e => console.error("Failed tracking usage", e));
            }

            let baseUrl = window.location.href.split('?')[0].split('#')[0];
            // Instead of forcing Vercel, allow localhost or Ngrok to stay what it is for testing
            // If we absolutely must default, make sure it points to our render backend or current origin

            return `${baseUrl}?id=${currentCardId}`;
        } catch (error) {
            console.error("Failed to generate share link", error);
            alert("Не удалось создать ссылку для этой открытки.");
            return window.location.href; // Fallback
        }
    };

    const getShareText = async () => {
        const url = await getShareUrl();
        return encodeURIComponent(`Привет! Я создал для тебя музыкальную открытку с помощью искусственного интеллекта! 🎁\n\nОткрой эту ссылку, чтобы послушать:\n${url}`);
    };

    shareTg.addEventListener('click', async () => {
        const url = await getShareUrl();
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Привет! Посмотри эту музыкальную открытку 🎁')}`, '_blank');
    });

    shareWa.addEventListener('click', async () => {
        const text = await getShareText();
        window.open(`https://wa.me/?text=${text}`, '_blank');
    });

    shareVb.addEventListener('click', async () => {
        const text = await getShareText();
        window.open(`viber://forward?text=${text}`, '_self');
    });

    shareCopy.addEventListener('click', async () => {
        try {
            const text = await getShareText();
            await navigator.clipboard.writeText(decodeURIComponent(text));
            const orig = shareCopy.innerHTML;
            shareCopy.innerHTML = '<i class="ph-bold ph-check"></i> Скопировано';
            setTimeout(() => shareCopy.innerHTML = orig, 2000);
        } catch (err) {
            console.error('Failed to copy', err);
            alert('Не удалось скопировать текст');
        }
    });

    copyTextBtn.addEventListener('click', async () => {
        const textToCopy = songLyrics.innerText.trim();
        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = copyTextBtn.innerHTML;
            copyTextBtn.innerHTML = '<i class="ph-bold ph-check"></i> Скопировано!';
            setTimeout(() => {
                copyTextBtn.innerHTML = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            alert('Не удалось скопировать текст. Попробуйте выделить его вручную.');
        }
    });

    // --- Reset Logic ---
    createNewBtn.addEventListener('click', () => {
        // Stop audio
        if (bgAudio) {
            bgAudio.pause();
            bgAudio.removeAttribute('src'); // strictly stop downloading
            bgAudio.load();
        }
        if (previewAudio) {
            previewAudio.pause();
            previewAudio.removeAttribute('src');
        }

        isPlaying = false;
        playIcon.classList.replace('ph-pause', 'ph-play');
        playPauseBtn.classList.remove('pulse-glow');
        if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
        canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);

        // Reset Form values
        form.reset();
        uploadFilename.innerHTML = 'Нажмите, чтобы выбрать .mp3 файл<br><small>(до 15 МБ)</small>';
        uploadFilename.style.color = '';
        uploadGeminiFilename.innerHTML = 'Нажмите, чтобы выбрать готовый трек<br><small>(до 15 МБ)</small>';
        uploadGeminiFilename.style.color = '';
        socialPanel.classList.add('hidden');
        voiceBtn.innerHTML = '<i class="ph-bold ph-microphone-stage"></i> Озвучить ИИ';
        voiceSelect.style.display = ''; // Show selector again if hidden

        const voiceControls = document.querySelector('.voice-controls:not(.hidden)');
        if (voiceControls) voiceControls.style.display = '';

        document.body.classList.remove('is-received-card');
        isReceivedCard = false;
        currentCardId = null;

        // Reset the button to original state
        createNewBtn.innerHTML = 'Создать новую открытку';
        createNewBtn.disabled = false;
        createNewBtn.classList.remove('disabled-btn');

        // Fetch the catalog again in case new tracks were added
        renderTrackCatalog();

        // Trigger change events to update UI based on default radio selections
        document.getElementById('src-catalog').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('mode-ai').dispatchEvent(new Event('change', { bubbles: true }));

        // Switch Views
        songLyrics.classList.remove('hidden');
        resultView.classList.add('hidden');
        form.classList.remove('hidden');
    });

    // --- Voice Synthesis Logic ---
    voiceBtn.addEventListener('click', async () => {
        // If this is a received card, the audio is already mixed. 
        // The button just acts as a play button.
        if (isReceivedCard) {
            await togglePlay();
            voiceBtn.classList.remove('pulse-glow');
            voiceBtn.innerHTML = '<i class="ph-bold ph-music-notes"></i> Играет песня...';
            return;
        }

        const textToSpeech = songLyrics.innerText.trim();
        if (!textToSpeech) return;

        const originalText = voiceBtn.innerHTML;
        voiceBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Сведение трека...';
        voiceBtn.disabled = true;

        try {
            // Unsuspend audio context synchronously
            initAudioContext();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            // We must now fetch the mixed track first because we need to send a POST request with bgUrl
            // Backend will now upload to Supabase and return the public URL
            const response = await fetch('/api/mix-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textToSpeech,
                    voice: voiceSelect.value,
                    bgUrl: originalAudioUrl || currentAudioUrl // Use original to prevent layering
                })
            });

            if (!response.ok) {
                throw new Error("Failed to mix track");
            }

            const data = await response.json();
            const mixUrl = data.mixUrl;

            // Update currentAudioUrl so that sharing saves the mixed track!
            currentAudioUrl = mixUrl;

            // Replace the background audio source with the new mixed track
            if (bgAudio) {
                bgAudio.pause();
                bgAudio.removeAttribute('src');
                bgAudio.load();
            }
            if (previewAudio) {
                previewAudio.pause();
            }

            bgAudio.src = mixUrl;

            // Important: we don't duck volume anymore because the server did it inside FFmpeg
            bgAudio.volume = 1.0;

            // Start playing the single mixed track
            await togglePlay(true);

            voiceBtn.innerHTML = '<i class="ph-bold ph-microphone-stage"></i> Пересоздать микс';
            voiceBtn.disabled = false;

        } catch (error) {
            console.error(error);
            alert('Не удалось свести трек на сервере: ' + error.message);
            voiceBtn.innerHTML = originalText;
            voiceBtn.disabled = false;
        }
    });

    // --- On Load: Check if Card is Shared in URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');

    const loadCardData = (data) => {
        resName.textContent = data.name;
        resOccasion.textContent = data.occasion;
        songLyrics.textContent = data.lyrics;
        playingMelodyName.textContent = data.melodyText;
        currentAudioUrl = data.audioUrl;
        originalAudioUrl = data.audioUrl; // Fallback for loaded cards

        if (data.hideCreateBtn) {
            createNewBtn.innerHTML = 'Создать новую открытку<br><span class="btn-subtitle">Опция появится позже</span>';
            createNewBtn.disabled = true;
            createNewBtn.classList.add('disabled-btn');
        } else {
            createNewBtn.innerHTML = 'Создать новую открытку';
            createNewBtn.disabled = false;
            createNewBtn.classList.remove('disabled-btn');
        }

        bgAudio.src = `/api/audio-proxy?url=${encodeURIComponent(currentAudioUrl)}`;
        bgAudio.volume = 1.0; // Play saved card at full volume (mix is already ducked)
        bgAudio.load();

        loadingState.classList.add('hidden');
        resultView.classList.remove('hidden');

        // The main play button in the player UI will suffice.
        const voiceControls = document.querySelector('.voice-controls');
        if (voiceControls) {
            voiceControls.style.display = 'none';
            // Also forcefully hide children for aggressive cache bypass
            const voiceBtnEl = document.getElementById('voice-btn');
            const voiceSelectEl = document.getElementById('voice-select');
            if (voiceBtnEl) voiceBtnEl.style.display = 'none';
            if (voiceSelectEl) voiceSelectEl.style.display = 'none';
        }

        document.body.classList.add('is-received-card');
        isReceivedCard = true;

        // Hide Catalog Manager for recipients
        const adminSection = document.querySelector('.catalog-manager-section');
        if (adminSection) adminSection.style.display = 'none';
    };

    if (cardId) {
        currentCardId = cardId;
        // Show loading state while fetching from the database
        form.classList.add('hidden');
        loadingState.classList.remove('hidden');

        fetch(`/api/cards/${cardId}`)
            .then(res => {
                if (!res.ok) throw new Error("Card not found");
                return res.json();
            })
            .then(data => {
                loadCardData(data);
                // Background analytics tracking: increment view count
                fetch(`/api/cards/${cardId}/view`, { method: 'POST' }).catch(e => console.error("Failed tracking view", e));
            })
            .catch(e => {
                console.error('Failed to fetch card data from URL', e);
                loadingState.classList.add('hidden');
                form.classList.remove('hidden');
                alert("К сожалению, открытка не найдена. Создайте свою!");
            });
    }

    // --- Catalog Manager Logic (Advanced Mode Only) ---
    const catalogManagerForm = document.getElementById('catalog-manager-form');
    if (catalogManagerForm) {
        catalogManagerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = catalogManagerForm.querySelector('.admin-submit-btn');
            const originalText = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Добавляем...';

            const formData = new FormData();
            formData.append('audio', document.getElementById('new-track-file').files[0]);
            formData.append('title', document.getElementById('new-track-title').value.trim());
            formData.append('genre', document.getElementById('new-track-genre').value.trim());
            formData.append('style', document.getElementById('new-track-style').value.trim());
            formData.append('icon', 'ph-music-note'); // Default icon

            try {
                const response = await fetch('/api/catalog-add', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    alert('Трек успешно добавлен в каталог!');
                    catalogManagerForm.reset();
                    renderTrackCatalog();
                } else {
                    const err = await response.json();
                    alert('Ошибка при добавлении: ' + (err.error || 'Неизвестная ошибка'));
                }
            } catch (err) {
                console.error('Upload failed:', err);
                alert('Сетевая ошибка при загрузке трека.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
});

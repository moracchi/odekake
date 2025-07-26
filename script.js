class OdekakeGacha {
    constructor() {
        this.places = this.loadPlaces();
        this.currentEditIndex = -1;
        this.isSpinning = false;
        
        // 確率設定（重み）
        this.probabilityWeights = {
            high: 5,    // 高確率：約50%
            medium: 3,  // 中確率：約30%
            low: 2      // 低確率：約20%
        };
        
        // 音声関連
        this.sounds = {
            spin: null,
            stop: null,
            result: null
        };
        
        this.initElements();
        this.initSounds();
        this.bindEvents();
        this.render();
        this.updateStorageInfo();
    }
    
    initElements() {
        // ガチャ関連
        this.gachaButton = document.getElementById('gachaButton');
        this.slotDisplay = document.getElementById('slotDisplay');
        this.placesCount = document.getElementById('placesCount');
        
        // 確率カウント表示
        this.highCount = document.getElementById('highCount');
        this.mediumCount = document.getElementById('mediumCount');
        this.lowCount = document.getElementById('lowCount');
        
        // リスト関連
        this.addButton = document.getElementById('addButton');
        this.placesGrid = document.getElementById('placesGrid');
        this.emptyState = document.getElementById('emptyState');
        
        // モーダル関連
        this.editModal = document.getElementById('editModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalClose = document.getElementById('modalClose');
        this.placeForm = document.getElementById('placeForm');
        this.placeName = document.getElementById('placeName');
        this.placeImage = document.getElementById('placeImage');
        this.imagePreview = document.getElementById('imagePreview');
        this.saveButton = document.getElementById('saveButton');
        this.cancelButton = document.getElementById('cancelButton');
        
        // 結果モーダル
        this.resultModal = document.getElementById('resultModal');
        this.resultImage = document.getElementById('resultImage');
        this.resultName = document.getElementById('resultName');
        this.resultProbability = document.getElementById('resultProbability');
        this.closeResult = document.getElementById('closeResult');
        this.retryGacha = document.getElementById('retryGacha');
        
        // 容量表示
        this.storageUsage = document.getElementById('storageUsage');
        
        // 音声コントロール
        this.soundEnabled = document.getElementById('soundEnabled');
        this.volumeControl = document.getElementById('volumeControl');
    }
    
    initSounds() {
        // 音声要素を取得
        this.sounds.spin = document.getElementById('spinSound');
        this.sounds.stop = document.getElementById('stopSound');
        this.sounds.result = document.getElementById('resultSound');
        
        // 音声ファイルがない場合のエラーハンドリング
        Object.keys(this.sounds).forEach(key => {
            if (this.sounds[key]) {
                this.sounds[key].volume = this.volumeControl.value;
                this.sounds[key].addEventListener('error', (e) => {
                    console.warn(`音声ファイル ${key} が見つかりません:`, e);
                    this.sounds[key] = null; // エラーの場合は無効化
                });
            }
        });
    }
    
    bindEvents() {
        // ガチャボタン
        this.gachaButton.addEventListener('click', () => this.executeGacha());
        
        // 追加ボタン
        this.addButton.addEventListener('click', () => this.openAddModal());
        
        // モーダル関連
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.cancelButton.addEventListener('click', () => this.closeModal());
        this.saveButton.addEventListener('click', () => this.savePlace());
        this.placeImage.addEventListener('change', (e) => this.previewImage(e));
        
        // 結果モーダル
        this.closeResult.addEventListener('click', () => this.closeResultModal());
        this.retryGacha.addEventListener('click', () => {
            this.closeResultModal();
            setTimeout(() => this.executeGacha(), 300);
        });
        
        // 音声コントロール
        this.soundEnabled.addEventListener('change', () => {
            this.saveSettings();
        });
        
        this.volumeControl.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            Object.values(this.sounds).forEach(sound => {
                if (sound) sound.volume = volume;
            });
            this.saveSettings();
        });
        
        // モーダル外クリックで閉じる
        this.editModal.addEventListener('click', (e) => {
            if (e.target === this.editModal) this.closeModal();
        });
        this.resultModal.addEventListener('click', (e) => {
            if (e.target === this.resultModal) this.closeResultModal();
        });
        
        // 設定を読み込み
        this.loadSettings();
    }
    
    loadSettings() {
        const settings = localStorage.getItem('gacha-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.soundEnabled.checked = parsed.soundEnabled !== false;
            this.volumeControl.value = parsed.volume || 0.5;
            
            // 音量を適用
            Object.values(this.sounds).forEach(sound => {
                if (sound) sound.volume = this.volumeControl.value;
            });
        }
    }
    
    saveSettings() {
        const settings = {
            soundEnabled: this.soundEnabled.checked,
            volume: parseFloat(this.volumeControl.value)
        };
        localStorage.setItem('gacha-settings', JSON.stringify(settings));
    }
    
    playSound(soundName) {
        if (!this.soundEnabled.checked || !this.sounds[soundName]) return;
        
        try {
            this.sounds[soundName].currentTime = 0;
            this.sounds[soundName].play().catch(e => {
                console.warn(`音声再生エラー (${soundName}):`, e);
            });
        } catch (e) {
            console.warn(`音声再生エラー (${soundName}):`, e);
        }
    }
    
    stopSound(soundName) {
        if (this.sounds[soundName]) {
            try {
                this.sounds[soundName].pause();
                this.sounds[soundName].currentTime = 0;
            } catch (e) {
                console.warn(`音声停止エラー (${soundName}):`, e);
            }
        }
    }
    
    loadPlaces() {
        const stored = localStorage.getItem('odekake-places');
        return stored ? JSON.parse(stored) : [];
    }
    
    savePlaces() {
        try {
            localStorage.setItem('odekake-places', JSON.stringify(this.places));
            this.updateStorageInfo();
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this.showToast('⚠️ 保存容量が不足しています。一部の画像を削除してください。', 'error');
                return false;
            }
        }
        return true;
    }
    
    // 容量チェック機能
    checkStorageCapacity() {
        try {
            const used = JSON.stringify(localStorage).length;
            const usedMB = used / (1024 * 1024);
            
            if (used > 4 * 1024 * 1024) { // 4MB以上
                this.showToast(`容量使用量: ${usedMB.toFixed(2)}MB - 上限に近づいています`, 'warning');
                return false;
            }
            return true;
        } catch (e) {
            console.error('容量チェックエラー:', e);
            return false;
        }
    }
    
    // 容量使用量表示更新
    updateStorageInfo() {
        try {
            const used = JSON.stringify(localStorage).length;
            const usedMB = (used / (1024 * 1024)).toFixed(2);
            this.storageUsage.textContent = usedMB;
            
            // 容量に応じて色を変更
            if (used > 4 * 1024 * 1024) {
                this.storageUsage.style.color = '#ff6b6b';
            } else if (used > 2 * 1024 * 1024) {
                this.storageUsage.style.color = '#f39c12';
            } else {
                this.storageUsage.style.color = 'white';
            }
        } catch (e) {
            this.storageUsage.textContent = '不明';
        }
    }
    
    // 画像リサイズ機能（4:3比率の320×240pxに統一）
    resizeImage(file, maxWidth = 320, maxHeight = 240, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // 4:3比率に固定してリサイズ
                const targetRatio = maxWidth / maxHeight; // 4:3 = 1.333...
                const imageRatio = img.width / img.height;
                
                let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
                
                if (imageRatio > targetRatio) {
                    // 横長の画像：高さを基準にして幅をトリミング
                    drawHeight = img.height;
                    drawWidth = img.height * targetRatio;
                    offsetX = (img.width - drawWidth) / 2;
                } else {
                    // 縦長の画像：幅を基準にして高さをトリミング
                    drawWidth = img.width;
                    drawHeight = img.width / targetRatio;
                    offsetY = (img.height - drawHeight) / 2;
                }
                
                // キャンバスサイズを設定
                canvas.width = maxWidth;
                canvas.height = maxHeight;
                
                // 画像を4:3比率でキャンバスに描画
                ctx.drawImage(
                    img,
                    offsetX, offsetY, drawWidth, drawHeight, // ソース画像の切り取り範囲
                    0, 0, maxWidth, maxHeight // キャンバス上の描画範囲
                );
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    render() {
        this.renderPlacesList();
        this.updateCounts();
    }
    
    renderPlacesList() {
        if (this.places.length === 0) {
            this.placesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📍</div>
                    <p>まだおでかけ先が登録されていません</p>
                    <p>「＋ 追加」ボタンから登録してみましょう！</p>
                </div>
            `;
            return;
        }
        
        this.placesGrid.innerHTML = this.places.map((place, index) => {
            const probabilityLabels = {
                high: '高確率',
                medium: '中確率', 
                low: '低確率'
            };
            
            return `
                <div class="place-card">
                    <img src="${place.image}" alt="${place.name}">
                    <div class="probability-badge ${place.probability}">${probabilityLabels[place.probability]}</div>
                    <h3>${place.name}</h3>
                    <div class="card-actions">
                        <button class="edit-btn" onclick="odekakeGacha.openEditModal(${index})">編集</button>
                        <button class="delete-btn" onclick="odekakeGacha.deletePlace(${index})">削除</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    updateCounts() {
        const counts = {
            high: this.places.filter(p => p.probability === 'high').length,
            medium: this.places.filter(p => p.probability === 'medium').length,
            low: this.places.filter(p => p.probability === 'low').length
        };
        
        this.placesCount.textContent = this.places.length;
        this.highCount.textContent = counts.high;
        this.mediumCount.textContent = counts.medium;
        this.lowCount.textContent = counts.low;
    }
    
    openAddModal() {
        this.currentEditIndex = -1;
        this.modalTitle.textContent = '新しい場所を追加';
        this.placeName.value = '';
        this.placeImage.value = '';
        this.imagePreview.innerHTML = '';
        
        // 高確率をデフォルト選択
        const highRadio = document.querySelector('input[name="probability"][value="high"]');
        if (highRadio) highRadio.checked = true;
        
        this.editModal.classList.add('active');
    }
    
    openEditModal(index) {
        this.currentEditIndex = index;
        const place = this.places[index];
        this.modalTitle.textContent = '場所を編集';
        this.placeName.value = place.name;
        this.placeImage.value = '';
        this.imagePreview.innerHTML = `<img src="${place.image}" alt="${place.name}">`;
        
        // 確率を選択
        const probabilityRadio = document.querySelector(`input[name="probability"][value="${place.probability}"]`);
        if (probabilityRadio) probabilityRadio.checked = true;
        
        this.editModal.classList.add('active');
    }
    
    closeModal() {
        this.editModal.classList.remove('active');
    }
    
    previewImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // ファイルサイズチェック（10MB以上は警告）
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('⚠️ 画像が大きすぎます。10MB以下の画像を選択してください。', 'warning');
            return;
        }
        
        // 画像リサイズしてプレビュー
        this.resizeImage(file).then(resizedImage => {
            this.imagePreview.innerHTML = `<img src="${resizedImage}" alt="プレビュー">`;
        });
    }
    
    async savePlace() {
        const name = this.placeName.value.trim();
        const imageFile = this.placeImage.files[0];
        const probabilityRadio = document.querySelector('input[name="probability"]:checked');
        const probability = probabilityRadio ? probabilityRadio.value : 'high';
        
        if (!name) {
            this.showToast('場所の名前を入力してください', 'error');
            return;
        }
        
        // 容量チェック
        if (!this.checkStorageCapacity()) {
            return;
        }
        
        const savePlace = async (imageData) => {
            const oldId = (this.currentEditIndex >= 0)
                         ? this.places[this.currentEditIndex].id
                         : Date.now();
                         
            const place = {
                name: name,
                image: imageData,
                probability: probability,
                id: oldId
            };
            
            if (this.currentEditIndex >= 0) {
                this.places[this.currentEditIndex] = place;
            } else {
                this.places.push(place);
            }
            
            if (this.savePlaces()) {
                this.render();
                this.closeModal();
                
                // 成功メッセージ
                this.showToast(
                    this.currentEditIndex >= 0 ? '場所を更新しました！' : '新しい場所を追加しました！',
                    'success'
                );
            }
        };
        
        if (imageFile) {
            const resizedImage = await this.resizeImage(imageFile);
            savePlace(resizedImage);
        } else if (this.currentEditIndex >= 0 && this.places[this.currentEditIndex].image) {
            // 編集時に画像を変更していない場合
            savePlace(this.places[this.currentEditIndex].image);
        } else {
            this.showToast('画像をアップロードしてください', 'error');
        }
    }
    
    deletePlace(index) {
        if (confirm(`「${this.places[index].name}」を削除してもよろしいですか？`)) {
            this.places.splice(index, 1);
            this.savePlaces();
            this.render();
            this.showToast('場所を削除しました', 'success');
        }
    }
    
    // 重み付きランダム選択
    selectByProbability() {
        const weightedArray = [];
        this.places.forEach((place, idx) => {
            const weight = this.probabilityWeights[place.probability] || 1;
            for (let i = 0; i < weight; i++) {
                weightedArray.push(idx);
            }
        });
        
        const randomIndex = Math.floor(Math.random() * weightedArray.length);
        const selectedIndex = weightedArray[randomIndex];
        return this.places[selectedIndex];
    }
    
    async executeGacha() {
        if (this.places.length === 0) {
            this.showToast('おでかけ先を追加してからガチャを回してください！', 'warning');
            return;
        }
        
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.gachaButton.disabled = true;
        this.addButton.disabled = true;
        this.gachaButton.innerHTML = '<span class="button-text">🎰 回転中...</span>';
        
        // 🎯 重要: 先に結果を決定
        const selectedPlace = this.selectByProbability();
        
        // スロット演出（結果を最後に表示）
        await this.spinSlot(selectedPlace);
        
        // 結果表示
        this.showResult(selectedPlace);
        
        // リセット
        this.isSpinning = false;
        this.gachaButton.disabled = false;
        this.addButton.disabled = false;
        this.gachaButton.innerHTML = '<span class="button-text">🎰 ガチャを回す！</span>';
    }
    
    async spinSlot(finalResult) {
        // 🔊 回転音を再生
        this.playSound('spin');
        
        // 高速回転演出
        this.slotDisplay.classList.add('slot-spinning');
        
        // ランダムな場所を高速で表示（30回）
        for (let i = 0; i < 30; i++) {
            const randomPlace = this.places[Math.floor(Math.random() * this.places.length)];
            this.slotDisplay.innerHTML = `
                <div class="slot-item">
                    <img src="${randomPlace.image}" alt="${randomPlace.name}">
                    <p>${randomPlace.name}</p>
                </div>
            `;
            await new Promise(resolve => setTimeout(resolve, 50 + i * 3));
        }
        
        // 🔊 回転音を停止
        this.stopSound('spin');
        
        // 徐々に減速（10回）
        for (let i = 0; i < 10; i++) {
            const randomPlace = this.places[Math.floor(Math.random() * this.places.length)];
            this.slotDisplay.innerHTML = `
                <div class="slot-item">
                    <img src="${randomPlace.image}" alt="${randomPlace.name}">
                    <p>${randomPlace.name}</p>
                </div>
            `;
            await new Promise(resolve => setTimeout(resolve, 100 + i * 20));
        }
        
        this.slotDisplay.classList.remove('slot-spinning');
        
        // 🎯 最終結果を表示（実際の抽選結果と一致）
        this.slotDisplay.innerHTML = `
            <div class="slot-item">
                <img src="${finalResult.image}" alt="${finalResult.name}">
                <p>${finalResult.name}</p>
            </div>
        `;
        
        // 🔊 停止音を再生
        this.playSound('stop');
        
        // ドラムロール効果
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    showResult(place) {
        const probabilityLabels = {
            high: '🔴 高確率で当選！',
            medium: '🟡 中確率で当選！',
            low: '🔵 低確率で当選！レア！'
        };
        
        this.resultImage.innerHTML = `<img src="${place.image}" alt="${place.name}">`;
        this.resultName.textContent = place.name;
        this.resultProbability.textContent = probabilityLabels[place.probability];
        this.resultModal.classList.add('active');
        
        // 🔊 結果音を再生
        this.playSound('result');
        
        // ポップ演出
        setTimeout(() => {
            this.resultModal.querySelector('.result-modal').classList.add('result-pop');
        }, 100);
        
        // 成功メッセージ
        const message = place.probability === 'low' ? 
            '🎉 レア当選！行き先が決まりました！' : 
            '🎉 行き先が決まりました！';
        this.showToast(message, 'success');
    }
    
    closeResultModal() {
        this.resultModal.classList.remove('active');
        this.resultModal.querySelector('.result-modal').classList.remove('result-pop');
    }
    
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const colors = {
            success: '#4ecdc4',
            warning: '#f39c12',
            error: '#ff6b6b'
        };
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// アプリケーション初期化
const odekakeGacha = new OdekakeGacha();

# Moradon Fortune

Canlı demo: [emrekentli.github.io/moradon-fortune](https://emrekentli.github.io/moradon-fortune/)

PixiJS 8 ve TypeScript ile hazırlanmış, yalnızca eğitim amaçlı Knight Online/Moradon temalı profesyonel slot demosu. Gerçek para, kullanıcı hesabı, ödeme veya uzak oyun servisi içermez.

## Çalıştırma

```bash
npm install
npm run dev
```

Üretim derlemesi:

```bash
npm run build
```

Kalite kontrolleri:

```bash
npm test
npm run simulate -- 1000000 20260824
npm run check:visual
```

Geliştirici paneli için oyunu `/?debug=1` adresinde açın. Buradan seed uygulanabilir; loss, Big Win ve Magic Anvil senaryoları ile Anvil +5/+7/+8 seviyeleri zorlanabilir. Doğrudan +7 sahnesi için `/?scene=anvil&level=7` kullanılabilir.

## İçerik

- Sabit ve denetlenebilir reel strip kullanan 5x3 makaralar, 20 ödeme çizgisi, hedef stop indeksleri, bounce settle, motion blur ve scatter anticipation
- STOP ile 500 ms altında kontrollü hızlı durdurma
- Knight Online referanslı Trina, Raptor ve Iron Bow kare animasyonları; diğer sembollere özel hareket/renk efektleri
- Çizgi çizgi kazanç döngüsü, renkli parçacıklar, coin rain, ekran sarsıntısı ve atlanabilir Big Win sunumu
- 3/4/5 Scatter ile 5/6/7 Anvil denemesi, +8 yolu ve oyuncunun seçtiği 1/2/3 Trina başarı artırımı
- Stereo makara duruşları, metal Anvil darbesi, WebAudio olay sesleri, Moradon atmosferi ve mute
- 10/25/50/100 spin AUTO; birbirinden ayrı Turbo Spin ve Hızlı Spin seçenekleri; son beş oyun geçmişi ve bütün sembolleri içeren ödeme tablosu
- Masaüstü, oynanabilir portre mobil HUD, safe-area desteği ve klavye kısayolları
- Seeded RNG, deterministik senaryolar, durum makinesi testleri ve bonus/retrigger dahil RTP simülatörü
- Pixi asset bundle manifesti ve sekme arka plandayken otomatik render durdurma

## Kontroller

- `SPIN`: Döndür; dönüş sırasında `STOP`: hızlı durdur
- `−` / `+`: Bahis değiştir
- `AUTO`: Otomatik oyun ayarlarını aç; aktif otomatik oyunu durdur
- `Turbo Spin`: Makara dönüşünü, inişini ve sekmesini en kısa süreye indirir; scatter bekletmesini kapatır
- `Hızlı Spin`: Makara akışını ve kazanç sunumunu kısaltır; otomatik çevrimler arasındaki beklemeyi azaltır
- Kazanç sunumunda `DEVAM`: animasyonu tamamla
- `♪`: Sesi aç/kapat
- Klavye: `Space`, `←`, `→`, `A`, `M`, `I`

## Matematik doğrulaması

Sabit `20260824` seed’i ve 1.000.000 ücretli spin ile son doğrulama; yeni sabit reel strip, oyuncunun Trina kullandığı Magic Anvil Free Spin’leri ve retrigger’lar dahil yaklaşık `%96.426` toplam RTP üretmiştir. Sonuçlar seed ve örneklem büyüklüğüne göre küçük sapmalar gösterebilir.

## Görsel kaynaklar

Görsel geliştirme sırasında Knight Online ekran görüntüleri referans alındı. Kullanılan yerel referanslar `references/` altında, oyuna hazır çıktılar `public/assets/` altındadır. Bu çalışma eğitim ve görsel prototip amaçlıdır; ticari kullanımda hak sahipliği ve lisanslar ayrıca değerlendirilmelidir.

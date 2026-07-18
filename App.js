import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
  ScrollView,
  StatusBar
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';

const { width, height } = Dimensions.get('window');

const MultiBotDubizzleProV11_Ultra_Final = () => {
  // --- States ---
  const [targetUrl, setTargetUrl] = useState('https://www.dubizzle.com.eg/en/mobile-phones-tablets-accessories-numbers/mobile-phones/?page=100');
  const [links, setLinks] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionPage, setCollectionPage] = useState(100);
  const [activeView, setActiveView] = useState('main'); // main, stats, browser, bots_view
  const [selectedBotIndex, setSelectedBotIndex] = useState(0);
  const [botStats, setBotStats] = useState(new Array(4).fill(0));
  const [logs, setLogs] = useState([]);
  const [botLinks, setBotLinks] = useState([[], [], [], []]);

  const lastPageRef = useRef(100);
  useKeepAwake();

  // --- Helpers ---

  // دالة لاستخراج رقم الصفحة من الرابط المدخل
  const getInitialPage = (url) => {
    try {
      const searchParams = new URLSearchParams(url.split('?')[1]);
      const page = searchParams.get('page');
      return page ? parseInt(page, 10) : 1;
    } catch (e) {
      return 1;
    }
  };

  const buildUrl = (page) => {
    try {
      const urlObj = new URL(targetUrl.includes('?') ? targetUrl.split('?')[0] : targetUrl);
      urlObj.searchParams.set('page', page);
      return urlObj.toString();
    } catch (e) { 
      return targetUrl; 
    }
  };

  // توزيع الروابط: كل بوت يستلم مصفوفة روابط منفصلة تماماً بالتناوب
  const distributeLinks = (allLinks) => {
    const packs = [[], [], [], []];
    allLinks.forEach((link, idx) => {
      packs[idx % 4].push(link);
    });
    setBotLinks(packs);
  };

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  };

  function resetForNextAd() {
    window.isProcessing = false;
    window.isDoneSent = false;
    window.sendRetryCount = 0;
    window.lastSendAt = 0;
    window.lastRetryAt = 0;
    window.lastFailureText = "";
  }

  function goBackToAdsList() {
    const backBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
      .find(el => /back|رجوع|عودة/i.test((el.innerText || el.textContent || '')));

    if (backBtn) {
      backBtn.click();
    } else {
      window.history.back();
    }
  }

  // --- المحرك الذكي المحقون بالكامل والمحدث لحل مشاكل التعليق والفشل ---
  const masterScript = `
(function() {
const log = (tag, msg) => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', tag, msg }));
const notify = (type) => window.ReactNativeWebView.postMessage(JSON.stringify({ type }));

const greetingOptions = ["لو عندك حاجة للبيع", "لو بتبيع أي حاجة", "عندك منتج أو سلعة حابب تبيعها؟"];
const platformOptions = ["متكتفيش بمنصة واحدة", "ماتعرضش في مكان واحد بس", "زود فرصك ومتعتمدش على موقع واحد"];
const callToAction = ["جرّبه الآن وشوف الفرق بنفسك", "نزله دلوقتي وجرب بنفسك", "مستني إيه؟ جربه فورا"];

// دالة لاختيار عنصر عشوائي
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 2. تمويه الرابط برمجياً داخل المتصفح لمنع فلاتر النصوص من لقطه كـ Link صريح فورا
const rawLink = "yalla-7b2b3" + "." + "web" + "." + "app"; 

// بناء نص ديناميكي متغير في كل مرة يتم فيها تشغيل السكريبت على شات جديد
const randomGreeting = getRandom(greetingOptions);
const randomPlatform = getRandom(platformOptions);
const randomCTA = getRandom(callToAction);

const myMessageText = \`\${randomGreeting}، \${randomPlatform}. اعرض إعلانك على دوبيزل وكمان على تطبيقنا لزيادة فرص الوصول للمشترين المهتمين. التطبيق بيوفر طريقة سهلة لعرض المنتجات، ونظام ذكي يساعد في وصول الإعلان للأشخاص الأكثر اهتماماً.

\${randomCTA} من هنا:
\${rawLink}\`;

const myUniquePart = "yalla-7b2b3";


window.isProcessing = false;
window.isDoneSent = false;
window.sendRetryCount = 0;
window.maxSendRetries = Infinity; 
window.lastSendAt = 0;
window.lastRetryAt = 0;
window.lastFailureText = "";

function getChatRoot() {
    return document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
}

// الدالة المحدثة لفحص الفشل أو علامة المنبه والمعلق
function hasSendFailure(chatRoot) {
    if (!chatRoot) return null;

    // 1. فحص نصوص الخطأ الصريحة (فشل الإرسال)
    const potentialErrors = chatRoot.querySelectorAll('.failed-status, [style*="color: red"], span, div');
    for (let el of potentialErrors) {
        const text = (el.textContent || '').trim();
        if (text === "Failed to send" || text === "فشل الإرسال" || text === "لم يتم الإرسال") {
            const rect = el.getBoundingClientRect();
            const isVisible = (rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight));
            if (isVisible) return el;
        }
    }

    // 2. فحص علامة المنبه / الساعة (الرسائل المعلقة التي لم تصل للصح)
    const pendingElements = chatRoot.querySelectorAll('svg[aria-label*="pending"], svg[aria-label*="clock"], .sending, .pending, [class*="clock"]');
    for (let el of pendingElements) {
        const rect = el.getBoundingClientRect();
        const isVisible = (rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight));
        if (isVisible) {
            // للتأكد أن المنبه مر عليه أكثر من 6 ثوانٍ وليس مجرد ثانية إرسال طبيعية
            if (window.lastSendAt > 0 && (Date.now() - window.lastSendAt > 6000)) {
                log("⏳ PENDING DETECTED", "تم رصد علامة المنبه المستمرة (معلقة)، سيتم التعامل معها كخطأ");
                return el; 
            }
        }
    }

    return null;
}

function fillMessage(chatInput) {
    try {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
                       Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

        if (setter && ('value' in chatInput)) {
            setter.call(chatInput, "");
            setter.call(chatInput, myMessageText);
        } else {
            chatInput.value = myMessageText;
            chatInput.innerText = myMessageText;
        }

        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    } catch (e) {
        log("❌ ERROR", e.message);
        return false;
    }
}

function clickSend(chatRoot, chatInput) {
    const sendBtn = Array.from(chatRoot.querySelectorAll("button, div[role='button'], a")).find(b =>
        /send|إرسال/i.test((b.innerText || b.textContent || '')) ||
        b.querySelector('svg[aria-label*="send"]')
    ) || document.querySelector('button[type="submit"]');

    window.lastSendAt = Date.now(); 

    if (sendBtn) {
        sendBtn.click();
        log("✉️ SENT", "تم الضغط على الإرسال");
        return true;
    }

    chatInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, keyCode: 13, which: 13 }));
    log("✉️ SENT", "تم الإرسال عبر Enter");
    return true;
}

function tryResend(chatRoot) {
    const chatInput = document.querySelector('textarea') ||
                      document.querySelector('[contenteditable="true"]') ||
                      document.querySelector('div[role="textbox"]');

    if (!chatInput) return false;

    chatInput.focus();
    chatInput.click();

    if (!fillMessage(chatInput)) return false;

    return clickSend(chatRoot, chatInput);
}

window.smartEngine = function() {
    const url = window.location.href;

    // --- مراقبة الوقت لمنع التعليق على صفحة بيضاء أو Loading مستمر ---
    if (window.lastPageActivity === undefined) {
        window.lastPageActivity = Date.now(); 
    }

    const isPageLoading = document.body && (
        document.body.innerText.toLowerCase().includes('loading') || 
        document.body.innerText.includes('جاري التحميل')
    );

    const isWhitePage = !document.body || document.body.innerHTML.trim() === "" || (document.body.innerText && document.body.innerText.trim().length < 10);

    if ((isWhitePage || isPageLoading) && (Date.now() - window.lastPageActivity > 15000)) {
        log("⏳ TIMEOUT DETECTED", "الصفحة معلقة على التحميل أو بيضاء! جاري الانتقال للإعلان التالي...");
        window.lastPageActivity = undefined; 
        notify("DONE"); 
        return;
    }

    if (!document.body || document.body.innerHTML.trim() === "" || (document.body.innerText && document.body.innerText.trim().length < 10)) {
        log("⚪ WHITE PAGE DETECTED", "تم اكتشاف صفحة بيضاء! جاري إعادة تحديث الصفحة...");
        window.location.reload();
        return;
    }

    if (url.includes('/chat/')) {
        const chatRoot = getChatRoot();
        const chatContent = chatRoot.innerText;

        const failedEl = hasSendFailure(chatRoot);

        if (failedEl) {
            const failureText = (failedEl.textContent || 'PENDING_CLOCK').trim();

            if (failureText !== window.lastFailureText) {
                window.lastFailureText = failureText;
                window.sendRetryCount = 0;
            }

            log("⚠️ SEND FAILED / PENDING", "تم اكتشاف فشل أو تعليق الإرسال");

            if (Date.now() - window.lastRetryAt < 5000) {
                window.isProcessing = false;
                return;
            }

            window.lastRetryAt = Date.now();
            window.isProcessing = true;

            const retryBtn = Array.from(chatRoot.querySelectorAll('button, div[role="button"], a'))
                .find(el => /Retry|إعادة المحاولة|إرسال/i.test((el.innerText || el.textContent || '')));

            if (retryBtn) {
                retryBtn.click();
                log("🔁 RETRY", "تم الضغط على زر إعادة المحاولة الأصلي");
            } else {
                log("🔁 RETRY", "لم يتم العثور على زر، يتم إعادة الإرسال يدويًا عبر الحقل الكتابي");
                setTimeout(() => {
                    tryResend(chatRoot);
                }, 1000);
            }

            setTimeout(() => { window.isProcessing = false; }, 4000);
            return;
        }

        if (window.lastFailureText && !failedEl) {
            window.lastFailureText = "";
            window.sendRetryCount = 0;
            window.history.back();
            return;
        }

        if (chatContent.includes(myUniquePart)) {
            if (!window.isDoneSent) {
                window.isDoneSent = true;
                log("✅ SUCCESS", "تم الإرسال بنجاح والتحقق من الرابط");
                window.isProcessing = true;

                setTimeout(() => {
                    notify("DONE");
                    setTimeout(() => {
                        window.history.back();
                    }, 500);
                }, 800);
            }
            return;
        }

        if (window.isProcessing) return;
        if (window.isDoneSent) return;

        const chatInput = document.querySelector('textarea') ||
                          document.querySelector('[contenteditable="true"]') ||
                          document.querySelector('div[role="textbox"]');

        if (chatInput && !window.isDoneSent && !chatContent.includes(myUniquePart)) {
            window.isProcessing = true;
            log("🎯 ACTION", "محاولة كتابة الرسالة الجديدة...");

            chatInput.focus();
            chatInput.click();

            try {
                if (!fillMessage(chatInput)) {
                    window.isProcessing = false;
                    return;
                }

                setTimeout(() => {
                    clickSend(chatRoot, chatInput);
                    setTimeout(() => { window.isProcessing = false; }, 8000);
                }, 1500);

            } catch (e) {
                log("❌ ERROR", e.message);
                window.isProcessing = false;
            }
        }
    }
    else if (url.includes('/ad/')) {
        window.isDoneSent = false;
        window.isProcessing = false;
        window.sendRetryCount = 0;
        window.lastFailureText = "";

        const chatBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
            .find(el => /chat|دردشة/i.test(el.innerText || el.textContent || ''));

        if (chatBtn) chatBtn.click();
        else notify("DONE");
    }
};

if (!window.engineRunning) {
    setInterval(window.smartEngine, 4000);
    window.engineRunning = true;
}
})();
true;
`;

  // --- Message Handler ---
  const handleMessage = (event, botIndex) => {
    try {
      const res = JSON.parse(event.nativeEvent.data);
      if (res.type === 'LOG') {
        addLog(`Bot ${botIndex + 1}: ${res.msg}`);
      }
      if (res.type === 'DONE') {
        setBotStats(prev => {
          const next = [...prev];
          next[botIndex] += 1;
          return next;
        });
      }
      if (res.type === 'LINKS') {
        const newLinks = [...new Set([...links, ...res.data])];
        setLinks(newLinks);
        distributeLinks(newLinks);

        if (res.data.length === 0 || newLinks.length >= 2000) {
          setIsCollecting(false);
          addLog("📥 اكتمل جمع الروابط بنجاح");
        } else {
          const nextP = lastPageRef.current + 1;
          lastPageRef.current = nextP;
          setCollectionPage(nextP);
        }
      }
    } catch (e) {}
  };

  const renderBotWebViews = () => {
    return botLinks.map((linksArray, i) => {
      const currentIdx = botStats[i];
      const linkToLoad = linksArray[currentIdx];
      const isVisible = activeView === 'bots_view' && selectedBotIndex === i;

      if (!isRunning || !linkToLoad) return null;

      return (
        <View
          key={`bot-${i}`}
          style={isVisible ? styles.botVisibleContainer : styles.botHiddenContainer}
        >
          <WebView
            source={{ uri: linkToLoad }}
            injectedJavaScript={masterScript}
            onMessage={(e) => handleMessage(e, i)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
          />
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>EgyMarket <Text style={{ color: '#ff5252' }}>V11 ULTRA</Text></Text>
          <Text style={styles.headerSub}>نظام البوتات المتعددة الذكي</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            const startPage = getInitialPage(targetUrl);
            setLinks([]);
            lastPageRef.current = startPage;
            setCollectionPage(startPage);
            setIsCollecting(true);
            addLog(`🔄 إعادة البدء من الصفحة ${startPage}...`);
          }}
        >
          <Text style={styles.refreshBtnText}>🔄 تحديث</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {[
          { id: 'main', label: 'التحكم' },
          { id: 'bots_view', label: 'العرض المباشر' },
          { id: 'stats', label: 'السجلات' },
          { id: 'browser', label: 'دخول' }
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveView(tab.id)}
            style={[styles.tab, activeView === tab.id && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeView === tab.id && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.viewport}>
        {activeView === 'main' && (
          <ScrollView style={{ flex: 1, padding: 15 }}>
            <Text style={styles.label}>رابط القسم المستهدف (سأقوم باستخراج الصفحة منه):</Text>
            <TextInput
              style={styles.mainInput}
              value={targetUrl}
              onChangeText={setTargetUrl}
              placeholder="ضع رابط القسم مع رقم الصفحة هنا..."
              placeholderTextColor="#666"
            />

            <View style={styles.miniStats}>
              <View style={styles.miniCard}>
                <Text style={styles.cLabel}>إجمالي الروابط</Text>
                <Text style={styles.cVal}>{links.length}</Text>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.cLabel}>تم إرساله</Text>
                <Text style={[styles.cVal, { color: '#2ecc71' }]}>{botStats.reduce((a, b) => a + b, 0)}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isCollecting ? '#95a5a6' : '#3498db' }]}
                onPress={() => {
                  const startPage = getInitialPage(targetUrl);
                  setLinks([]);
                  setBotStats(new Array(4).fill(0));
                  lastPageRef.current = startPage;
                  setCollectionPage(startPage);
                  setIsCollecting(true);
                  addLog(`🔎 بدء الجمع من صفحة ${startPage}...`);
                }}
              >
                <Text style={styles.btnTxt}>{isCollecting ? "جاري الجمع..." : "1. جمع الروابط"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isRunning ? '#e74c3c' : '#2ecc71' }]}
                onPress={() => links.length > 0 && setIsRunning(!isRunning)}
              >
                <Text style={styles.btnTxt}>{isRunning ? "إيقاف البوتات" : "2. بدء الإرسال"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>حالة البوتات المنفصلة</Text>
            <View style={styles.botGrid}>
              {botStats.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.botCard}
                  onPress={() => { setSelectedBotIndex(index); setActiveView('bots_view'); }}
                >
                  <Text style={styles.botCardTitle}>BOT {index + 1}</Text>
                  <Text style={styles.botCardText}>روابطي: {botLinks[index].length}</Text>
                  <Text style={styles.botCardText}>منجز: {item}</Text>
                  <View style={[styles.statusDot, { backgroundColor: (isRunning && botLinks[index][item]) ? "#2ecc71" : "#e74c3c" }]} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {activeView === 'bots_view' && (
          <View style={{ flex: 1 }}>
            <View style={styles.botSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[0, 1, 2, 3].map(i => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setSelectedBotIndex(i)}
                    style={[styles.botTab, selectedBotIndex === i && styles.botTabActive]}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>BOT {i + 1}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.webviewPlaceholder}>
              {!isRunning && <Text style={styles.emptyMsg}>البوتات متوقفة. اضغط "بدء الإرسال" من شاشة التحكم.</Text>}
            </View>
          </View>
        )}

        {activeView === 'stats' && (
          <FlatList
            data={logs}
            renderItem={({ item }) => <Text style={styles.logText}>{item}</Text>}
            keyExtractor={(_, i) => i.toString()}
            style={styles.logContainer}
          />
        )}

        {activeView === 'browser' && (
          <WebView source={{ uri: 'https://www.dubizzle.com.eg/en/' }} style={{ flex: 1 }} userAgent="Mozilla/5.0 (Linux; Android 13)" />
        )}
      </View>

      {isCollecting && (
        <View style={styles.botHiddenContainer}>
          <WebView
            key={collectionPage}
            source={{ uri: buildUrl(collectionPage) }}
            injectedJavaScript={`
              (function() {
                setTimeout(() => {
                  const ads = Array.from(document.querySelectorAll('a'))
                    .map(a => a.href)
                    .filter(h => h && h.includes('/ad/') && !h.includes('/favorites/'));
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LINKS', data: ads }));
                }, 6000);
              })();
              true;
            `}
            onMessage={(e) => handleMessage(e, -1)}
          />
        </View>
      )}

      {renderBotWebViews()}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 15, paddingTop: 20, backgroundColor: '#1e1e1e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#666', fontSize: 10 },
  refreshBtn: { backgroundColor: '#333', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
  refreshBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1e1e1e', borderBottomWidth: 1, borderBottomColor: '#333' },
  tab: { flex: 1, padding: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#007AFF' },
  tabText: { color: '#888', fontWeight: 'bold', fontSize: 11 },
  activeTabText: { color: '#fff' },
  viewport: { flex: 1 },
  label: { color: '#aaa', marginBottom: 5, fontSize: 11 },
  mainInput: { backgroundColor: '#2c3e50', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 15 },
  miniStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  miniCard: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, width: '48%', alignItems: 'center' },
  cLabel: { color: '#888', fontSize: 11 },
  cVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { padding: 15, borderRadius: 10, width: '48%', alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  botGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  botCard: { backgroundColor: "#1e1e1e", width: "31%", marginBottom: 10, padding: 10, borderRadius: 10, alignItems: 'center' },
  botCardTitle: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  botCardText: { color: "#888", fontSize: 10, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  logContainer: { flex: 1, backgroundColor: '#000', padding: 10 },
  logText: { color: '#00ff00', fontSize: 11, marginBottom: 5, fontFamily: 'monospace' },
  botHiddenContainer: { width: 0, height: 0, position: 'absolute', opacity: 0 },
  botVisibleContainer: { position: 'absolute', top: 180, bottom: 0, left: 0, right: 0, backgroundColor: '#fff', zIndex: 999 },
  botSelector: { backgroundColor: '#1e1e1e', padding: 10 },
  botTab: { paddingHorizontal: 15, paddingVertical: 8, marginRight: 10, borderRadius: 20, backgroundColor: '#333' },
  botTabActive: { backgroundColor: '#007AFF' },
  webviewPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyMsg: { color: '#666', textAlign: 'center' }
});

export default MultiBotDubizzleProV11_Ultra_Final;
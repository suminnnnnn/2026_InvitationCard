(function () {
  "use strict";

  // 이름 최대 글자 수 (초대장 레이아웃 기준)
  var MAX = 10;

  var $ = function (id) { return document.getElementById(id); };
  var screenForm = $("screen-form");
  var screenCard = $("screen-card");
  var form = $("name-form");
  var inputTo = $("input-to");
  var inputFrom = $("input-from");
  var btnCreate = $("btn-create");
  var card = $("card");
  var btnSave = $("btn-save");
  var btnBack = $("btn-back");
  var overlay = $("save-overlay");
  var saveImage = $("save-image");
  var toast = $("toast");

  /* ---------- 환경 감지 ---------- */

  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid;
  var isKakao = /KAKAOTALK/i.test(ua);
  var isInApp = isKakao ||
    /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Twitter|Threads|; wv\)/i.test(ua);
  // WebKit은 첫 캡처에서 폰트/이미지가 빠지는 경우가 있어 예열 렌더가 필요하다
  var isWebKit = isIOS || (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|Android/i.test(ua));

  /* ---------- 이름 처리 ---------- */

  // maxLength는 한글 조합 중에 우회될 수 있어 JS로도 한 번 더 자른다
  function limit(value) {
    if (value.length <= MAX) return value;
    var cut = value.slice(0, MAX);
    // 이모지(서로게이트 쌍)가 반으로 잘리지 않게
    var last = cut.charCodeAt(cut.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
    return cut;
  }

  function clean(value) {
    return limit(String(value || "").trim());
  }

  function readNamesFromUrl() {
    var params = new URLSearchParams(location.search);
    return { to: clean(params.get("to")), from: clean(params.get("from")) };
  }

  /* ---------- 화면 전환 ---------- */

  function showForm() {
    screenCard.hidden = true;
    screenForm.hidden = false;
    updateCreateButton();
    window.scrollTo(0, 0);
  }

  function showCard(names) {
    $("card-to-name").textContent = names.to;
    $("card-from-name").textContent = names.from;
    screenForm.hidden = true;
    screenCard.hidden = false;
    window.scrollTo(0, 0);

    fitAll();
    // 폰트가 늦게 로드되면 글자 폭이 달라지므로 다시 맞춘 뒤, 저장용 이미지를 미리 만들어 둔다.
    // (미리 만들어 둬야 버튼을 누른 직후 공유 시트를 띄울 수 있다 — 사용자 제스처 유효 시간 제한)
    fontsReady().then(function () {
      fitAll();
      getBlob().catch(function () { /* 저장 버튼을 눌렀을 때 다시 시도 */ });
    });
  }

  function route() {
    var names = readNamesFromUrl();
    if (names.to && names.from) {
      // 공유 링크로 들어온 경우에도 `다시 만들기` 시 값이 남아 있도록
      inputTo.value = names.to;
      inputFrom.value = names.from;
      showCard(names);
    } else {
      // 이름 없이 화면 2에 직접 접근 → 화면 1
      if (location.search) history.replaceState(null, "", location.pathname);
      showForm();
    }
  }

  /* ---------- 화면 1: 입력 ---------- */

  function updateCreateButton() {
    btnCreate.disabled = !(clean(inputTo.value) && clean(inputFrom.value));
  }

  function onInput(e) {
    var input = e.target;
    // 조합 중에 값을 건드리면 한글 입력이 깨진다. 조합이 끝난 뒤(compositionend) 자른다.
    if (!e.isComposing && input.value.length > MAX) input.value = limit(input.value);
    updateCreateButton();
  }

  function onCompositionEnd(e) {
    var input = e.target;
    if (input.value.length > MAX) input.value = limit(input.value);
    updateCreateButton();
  }

  function isComposingEnter(e) {
    return e.isComposing || e.keyCode === 229;
  }

  function submit() {
    var to = clean(inputTo.value);
    var from = clean(inputFrom.value);
    if (!to || !from) return;
    inputTo.value = to;
    inputFrom.value = from;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    var query = "?to=" + encodeURIComponent(to) + "&from=" + encodeURIComponent(from);
    history.pushState(null, "", location.pathname + query);
    route();
  }

  [inputTo, inputFrom].forEach(function (input) {
    input.maxLength = MAX;
    input.addEventListener("input", onInput);
    input.addEventListener("compositionend", onCompositionEnd);
  });

  inputTo.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (isComposingEnter(e)) return;
    inputFrom.focus();
  });

  inputFrom.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (isComposingEnter(e)) return;
    submit();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    submit();
  });

  /* ---------- 화면 2: 글자 크기 맞춤 ---------- */

  var FIT_MIN_RATIO = 0.45;

  function fitText(el) {
    el.style.fontSize = "";
    var size = parseFloat(getComputedStyle(el).fontSize);
    var min = size * FIT_MIN_RATIO;
    while (el.scrollWidth > el.clientWidth && size > min) {
      size -= 0.5;
      el.style.fontSize = size + "px";
    }
  }

  function fitAll() {
    if (screenCard.hidden) return;
    card.querySelectorAll(".fit").forEach(fitText);
  }

  /* ---------- 화면 2: 캡처 ---------- */

  function fontsReady() {
    return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  }

  function imagesReady() {
    var imgs = Array.prototype.slice.call(card.querySelectorAll("img"));
    return Promise.all(imgs.map(function (img) {
      if (img.complete && img.naturalWidth) return null;
      return new Promise(function (resolve) {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  var CARD_SOURCE_WIDTH = 1102;

  var fontCssPromise = null;
  function getFontCss() {
    if (!fontCssPromise) fontCssPromise = window.htmlToImage.getFontEmbedCSS(card);
    return fontCssPromise;
  }

  function render() {
    return Promise.all([fontsReady(), imagesReady()])
      .then(getFontCss)
      .then(function (fontEmbedCSS) {
        var options = {
          // 초대장 원본 이미지 해상도(가로 1102px)로 저장 — 화면 표시 크기의 약 3~4배
          pixelRatio: CARD_SOURCE_WIDTH / card.offsetWidth,
          fontEmbedCSS: fontEmbedCSS,
        };
        var warmUp = isWebKit ? window.htmlToImage.toCanvas(card, options) : Promise.resolve();
        return warmUp.then(function () {
          return window.htmlToImage.toBlob(card, options);
        });
      })
      .then(function (blob) {
        if (!blob) throw new Error("capture failed");
        return blob;
      });
  }

  // 같은 초대장을 여러 번 저장할 때 다시 그리지 않도록 캐시
  var blobCache = { key: null, promise: null };
  function getBlob() {
    var key = [$("card-to-name").textContent, $("card-from-name").textContent, card.offsetWidth].join("|");
    if (blobCache.key !== key) {
      var promise = render();
      blobCache = { key: key, promise: promise };
      promise.catch(function () {
        if (blobCache.promise === promise) blobCache = { key: null, promise: null };
      });
    }
    return blobCache.promise;
  }

  /* ---------- 화면 2: 저장 ---------- */

  function fileName() {
    var to = $("card-to-name").textContent
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
      .replace(/^[.\s]+|[.\s]+$/g, "");
    return "초대장" + (to ? "_" + to : "") + ".png";
  }

  function setBusy(busy) {
    btnSave.disabled = busy;
    btnSave.classList.toggle("is-busy", busy);
    btnSave.querySelector(".btn-text").textContent = busy ? "저장 중…" : "저장하기";
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function showOverlay(blob) {
    // 일부 인앱 브라우저는 blob: URL 이미지를 길게 눌러 저장하지 못해 data URL을 쓴다
    var reader = new FileReader();
    reader.onload = function () {
      saveImage.src = reader.result;
      overlay.hidden = false;
    };
    reader.readAsDataURL(blob);
  }

  function hideOverlay() {
    overlay.hidden = true;
    saveImage.removeAttribute("src");
  }

  function save(blob) {
    var name = fileName();
    var file = null;
    try {
      file = new File([blob], name, { type: "image/png" });
    } catch (e) { /* File 생성자 미지원 */ }

    // 1) 모바일: 공유 시트 → "이미지 저장"
    if (isMobile && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).catch(function (err) {
        if (err && err.name === "AbortError") return; // 사용자가 공유 시트를 닫음
        showOverlay(blob);
      });
    }
    // 3) <a download>가 동작하지 않는 환경: 이미지를 띄우고 길게 눌러 저장
    if (isInApp || isIOS) {
      showOverlay(blob);
      return Promise.resolve();
    }
    // 2) 일반 다운로드
    download(blob, name);
    showToast("초대장을 저장했어요");
    return Promise.resolve();
  }

  btnSave.addEventListener("click", function () {
    if (btnSave.disabled) return;
    setBusy(true);
    getBlob()
      .then(save)
      .catch(function (err) {
        console.error(err);
        showToast("저장에 실패했어요. 다시 시도해 주세요");
      })
      .then(function () { setBusy(false); });
  });

  $("btn-overlay-close").addEventListener("click", hideOverlay);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) hideOverlay();
  });

  /* ---------- 화면 2: 다시하기 ---------- */

  btnBack.addEventListener("click", function () {
    history.pushState(null, "", location.pathname);
    route();
  });

  /* ---------- 인앱 브라우저 안내 ---------- */

  function setupInAppNotice() {
    if (!isInApp) return;
    $("inapp-notice").hidden = false;
    if (isIOS && !isKakao) {
      $("inapp-hint").textContent = "메뉴(⋯)에서 ‘Safari로 열기’를 선택해 주세요.";
    }

    var btn = $("btn-external");
    if (!isKakao && !isAndroid) return;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      if (isKakao) {
        location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
      } else {
        location.href = "intent://" + location.host + location.pathname + location.search +
          "#Intent;scheme=" + location.protocol.replace(":", "") + ";package=com.android.chrome;end";
      }
    });
  }

  /* ---------- 데스크톱 안내 ---------- */

  function showDesktopGate() {
    // 공유 링크(?to=..&from=..)로 들어온 경우 휴대폰에서도 같은 초대장이 열리도록 현재 주소 그대로 담는다
    var qr = window.qrcode(0, "M");
    qr.addData(location.href);
    qr.make();
    $("desktop-qr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    document.querySelector(".app").hidden = true;
    $("desktop-gate").hidden = false;
  }

  /* ---------- 토스트 ---------- */

  var toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }

  /* ---------- 시작 ---------- */

  // 모바일 전용: 데스크톱에서는 안내 문구와 현재 주소의 QR 코드만 보여 준다
  if (!isMobile) {
    showDesktopGate();
    return;
  }

  setupInAppNotice();
  window.addEventListener("popstate", route);
  window.addEventListener("resize", fitAll);
  route();
})();

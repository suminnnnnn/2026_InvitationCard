(function () {
  "use strict";

  // 이름 최대 글자 수 (초대장 레이아웃 기준)
  var MAX = 10;
  // true면 데스크톱에서 "모바일로 접속해주세요" + QR만 보여 준다. (데스크톱에서 확인하려면 잠시 false로)
  var MOBILE_ONLY = true;

  var $ = function (id) { return document.getElementById(id); };
  var screenForm = $("screen-form");
  var screenCard = $("screen-card");
  var form = $("name-form");
  var inputTo = $("input-to");
  var inputFrom = $("input-from");
  var btnCreate = $("btn-create");
  var cardImage = $("card-image");
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

  var currentNames = { to: "", from: "" };

  function showCard(names) {
    currentNames = names;
    screenForm.hidden = true;
    screenCard.hidden = false;
    window.scrollTo(0, 0);

    // 이름이 들어간 초대장 이미지를 한 번만 만들어 미리보기와 저장에 똑같이 쓴다.
    // (미리 만들어 둬야 저장 버튼을 누른 직후 공유 시트를 띄울 수 있다 — 사용자 제스처 유효 시간 제한)
    cardImage.alt = "To. " + names.to + ", From. " + names.from + " — PLAYLIST 졸업전시 초대장";
    getBlob().then(function (blob) {
      if (currentNames !== names) return;
      setPreview(URL.createObjectURL(blob));
    }).catch(function (err) {
      console.error(err);
    });
  }

  var previewUrl = null;
  function setPreview(url) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = url;
    cardImage.src = url || CARD.src;
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

  /* ---------- 화면 2: 초대장 이미지 만들기 ---------- */

  // 배경 이미지(assets/card.jpg)는 Figma "초대장" 프레임(550×434)을 2배 크기로 내보내면서 이름만 뺀 것.
  // 아래 이름 값은 같은 프레임의 텍스트 레이어 값을 그대로 옮겼다 (단위: 프레임 px).
  var CARD = {
    src: "assets/card.jpg",
    width: 1100,
    height: 868,
    scale: 2,                       // 프레임 1px = 이미지 2px
    fontSize: 29,                   // Pretendard Black
    lineHeight: 35,
    stroke: 3,                      // 흰색, 바깥쪽
    to:   { x: 95,  y: 31,  maxWidth: 436 },
    from: { x: 393, y: 217, maxWidth: 148 },
    minFontRatio: 0.45,             // 이름이 길면 이 비율까지 글자를 줄이고, 그래도 넘치면 말줄임
  };
  var CARD_FONT_FAMILY = '"Pretendard", -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  // Pretendard의 기준선 위치(ascent / (ascent + descent)) — 텍스트 상자 위쪽에서 기준선까지의 비율
  var BASELINE_RATIO = 1950 / 2444;

  function cardFont(size) {
    return "900 " + size + "px " + CARD_FONT_FAMILY;
  }

  var cardBgPromise = null;
  function loadCardBackground() {
    if (!cardBgPromise) {
      cardBgPromise = new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { cardBgPromise = null; reject(new Error("card image failed to load")); };
        img.src = CARD.src;
      });
    }
    return cardBgPromise;
  }

  // 웹폰트가 로드된 뒤 그려야 한다 (폰트 미적용 상태로 저장되는 문제 방지)
  function loadCardFont(text) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return document.fonts.load(cardFont(CARD.fontSize), text).catch(function () { /* 기본 글꼴로 그린다 */ });
  }

  function drawName(ctx, text, slot) {
    var k = CARD.scale;
    var maxWidth = slot.maxWidth * k;
    var size = CARD.fontSize * k;
    var minSize = size * CARD.minFontRatio;

    ctx.font = cardFont(size);
    while (ctx.measureText(text).width > maxWidth && size > minSize) {
      size -= 1;
      ctx.font = cardFont(size);
    }
    if (ctx.measureText(text).width > maxWidth) {
      var chars = Array.from(text);
      while (chars.length > 1 && ctx.measureText(chars.join("") + "…").width > maxWidth) chars.pop();
      text = chars.join("") + "…";
    }

    var x = slot.x * k;
    var baseline = (slot.y + CARD.lineHeight * BASELINE_RATIO) * k;
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    // 바깥쪽 외곽선: 두께의 2배로 선을 긋고 그 위에 글자를 채운다
    ctx.lineWidth = CARD.stroke * 2 * k;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(text, x, baseline);
    ctx.fillStyle = "#000";
    ctx.fillText(text, x, baseline);
  }

  function render(names) {
    return Promise.all([loadCardBackground(), loadCardFont(names.to + names.from)]).then(function (results) {
      var canvas = document.createElement("canvas");
      canvas.width = CARD.width;
      canvas.height = CARD.height;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(results[0], 0, 0, CARD.width, CARD.height);
      drawName(ctx, names.to, CARD.to);
      drawName(ctx, names.from, CARD.from);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("capture failed"));
        }, "image/png");
      });
    });
  }

  // 같은 초대장을 여러 번 저장할 때 다시 그리지 않도록 캐시
  var blobCache = { key: null, promise: null };
  function getBlob() {
    var key = currentNames.to + "\n" + currentNames.from;
    if (blobCache.key !== key) {
      var promise = render(currentNames);
      blobCache = { key: key, promise: promise };
      promise.catch(function () {
        if (blobCache.promise === promise) blobCache = { key: null, promise: null };
      });
    }
    return blobCache.promise;
  }

  /* ---------- 화면 2: 저장 ---------- */

  function fileName() {
    var to = currentNames.to
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
    setPreview(null);
    // 입력했던 이름도 비우고 처음부터 다시
    inputTo.value = "";
    inputFrom.value = "";
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
  if (MOBILE_ONLY && !isMobile) {
    showDesktopGate();
    return;
  }

  setupInAppNotice();
  window.addEventListener("popstate", route);
  route();
})();

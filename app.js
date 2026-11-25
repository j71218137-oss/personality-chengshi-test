(() => {
  'use strict';

  const { traits, questions, cities } = window.TravelTestData;
  const cityImages = window.TravelCityImages;
  const get = (id) => document.getElementById(id);
  const set = (id, value) => { get(id).textContent = value; };
  const storageKey = 'soul-travel-club:answers:v1';
  const emptyAnswers = () => Array(questions.length).fill(null);

  function readTrip() {
    try {
      const trip = JSON.parse(localStorage.getItem(storageKey));
      const valid = trip && Array.isArray(trip.answers) &&
        trip.answers.length === questions.length &&
        trip.answers.every((value) => value === null || (Number.isInteger(value) && value >= 0 && value < 4)) &&
        Number.isInteger(trip.index) && trip.index >= 0 && trip.index < questions.length &&
        trip.answers.slice(0, trip.index).every((answer) => answer !== null);
      if (valid) {
        trip.finished = trip.finished === true && trip.answers.every((answer) => answer !== null);
        return trip;
      }
    } catch {
      // A local file may be opened with browser storage disabled.
    }
    return { answers: emptyAnswers(), index: 0, finished: false };
  }

  let trip = readTrip();
  let result;
  let posterUrl;

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(trip));
    } catch {
      // The current trip still works entirely in memory.
    }
  }

  function tieKey(answers, cityId) {
    const input = answers.join('') + cityId;
    let hash = 2166136261;
    for (const character of input) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    return hash >>> 0;
  }

  function score(answers) {
    const vector = Array(traits.length).fill(0);
    answers.forEach((answer, index) => {
      for (const [trait, points] of questions[index].options[answer].weights) {
        vector[trait] += points;
      }
    });

    // All city profiles have the same length, so the dot product ranks cosine similarity.
    const ranks = cities.map((city) => ({
      city,
      fit: city.profile.reduce((sum, preference, index) => sum + preference * vector[index], 0),
      tie: tieKey(answers, city.id),
    }));
    ranks.sort((left, right) => right.fit - left.fit || right.tie - left.tie);
    const { city, fit } = ranks[0];
    const length = Math.hypot(...vector) * Math.hypot(...city.profile);
    const alignment = length ? Math.min(1, Math.max(0, fit / length)) : 0;
    const affinities = city.profile.map((preference, index) => ({
      strength: preference * vector[index],
      description: traits[index][vector[index] > 0 ? 2 : 1],
    })).filter(({ strength }) => strength > 0)
      .sort((left, right) => right.strength - left.strength)
      .slice(0, 2)
      .map(({ description }) => description);

    return {
      city,
      match: Math.round(64 + 35 * alignment),
      partner: cities.find((option) => option.id === city.partner),
      affinities,
    };
  }

  function show(id, focusId) {
    for (const view of document.querySelectorAll('.view')) {
      view.hidden = view.id !== id;
    }
    const view = get(id);
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
    window.scrollTo(0, 0);
    get(focusId).focus({ preventScroll: true });
  }

  function showHome(moveFocus = true) {
    const hasAnswers = trip.answers.some((answer) => answer !== null);
    set('start-text', trip.finished ? '查看我的明信片' : hasAnswers ? '继续我的旅程' : '领取车票，开始测试');
    get('start-over').hidden = !hasAnswers;
    if (moveFocus) show('home', 'home-title');
  }

  function updateProgress() {
    const completed = trip.answers.filter((answer) => answer !== null).length;
    get('progress').value = completed;
    get('progress').setAttribute('aria-valuetext', '已选 ' + completed + ' / ' + questions.length + ' 题');
  }

  function showQuestion() {
    const { index, answers } = trip;
    const question = questions[index];
    set('current-number', String(index + 1).padStart(2, '0'));
    set('question-title', question.prompt);
    set('back', index === 0 ? '返回首页' : '上一题');
    set('next', index === questions.length - 1 ? '查看测试结果' : '下一题');
    get('next').disabled = answers[index] === null;
    updateProgress();

    const choices = question.options.map(({ text }, option) => {
      const label = document.createElement('label');
      label.className = 'choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = String(option);
      input.checked = answers[index] === option;
      const letter = document.createElement('span');
      letter.className = 'choice-letter';
      letter.textContent = String.fromCharCode(65 + option);
      letter.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      copy.textContent = text;
      label.append(input, letter, copy);
      return label;
    });
    get('choices').replaceChildren(...choices);
    show('quiz', 'question-title');
  }

  function releasePoster() {
    get('poster-preview').removeAttribute('src');
    get('download-poster').removeAttribute('href');
    if (posterUrl) URL.revokeObjectURL(posterUrl);
    posterUrl = undefined;
  }

  function showResult() {
    result = score(trip.answers);
    const { city, match, partner, affinities } = result;
    releasePoster();
    const poster = get('poster');
    poster.style.setProperty('--city', city.color);
    poster.style.setProperty('--city-tint', city.shade);
    get('city-image').src = cityImages[city.id];
    get('city-image').alt = city.name + '旅行插画，' + city.landmark;
    set('landmark', city.landmark);
    set('city-name', city.name);
    set('city-roman', city.roman);
    set('match-index', match + '%');
    set('city-quote', '“' + city.quote + '”');
    set('city-persona', city.persona);
    set('details-persona', city.persona);
    set('city-traits', city.traits);
    set('city-reason', city.reason);
    set('city-affinities', affinities.join(' · '));
    get('affinity-block').hidden = affinities.length === 0;
    set('city-life', city.life);
    set('city-strength', city.strength);
    set('partner-name', partner.name);
    set('partner-persona', partner.persona);
    set('save-status', '');
    get('tags').replaceChildren(...city.tags.map((tag) => {
      const item = document.createElement('li');
      item.textContent = tag;
      return item;
    }));
    show('result', 'result-title');
  }

  function resetTrip() {
    trip = { answers: emptyAnswers(), index: 0, finished: false };
    releasePoster();
    persist();
    showQuestion();
  }

  const sans = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  const serif = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';

  function drawCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    ctx.drawImage(
      image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2,
      sourceWidth, sourceHeight, x, y, width, height,
    );
  }

  function printQuote(ctx, text, x, y, maxWidth) {
    const lines = [];
    let line = '';
    for (const character of text) {
      if (line && ctx.measureText(line + character).width > maxWidth && !/[，。？！、”]/u.test(character)) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
    lines.push(line);
    lines.forEach((content, index) => ctx.fillText(content, x, y + 48 * index, maxWidth + 12));
  }

  async function renderPoster({ city, match, partner }) {
    const image = get('city-image');
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.scale(4 / 3, 4 / 3);

    ctx.fillStyle = '#faf0dc';
    ctx.fillRect(0, 0, 900, 1350);
    for (let index = 0; index < 14000; index += 1) {
      const x = (index * 12289) % 899;
      const y = (index * 3079 + Math.floor(index / 59) * 53) % 1349;
      ctx.fillStyle = index % 4 === 0 ? '#ffffff85' : '#684b3210';
      ctx.fillRect(x, y, index % 3 + 1, 1);
    }
    ctx.strokeStyle = '#bdac92';
    ctx.lineWidth = 1;
    ctx.strokeRect(34.5, 34.5, 831, 1281);
    ctx.fillStyle = city.color;
    ctx.font = '700 24px ' + sans;
    ctx.fillText('✳  灵魂旅行局', 60, 87);
    ctx.textAlign = 'right';
    ctx.font = '700 20px monospace';
    ctx.fillText('SOUL POSTCARD', 840, 87);
    ctx.textAlign = 'left';

    drawCover(ctx, image, 60, 112, 780, 538);
    const imageFade = ctx.createLinearGradient(0, 565, 0, 650);
    imageFade.addColorStop(0, '#182d2800');
    imageFade.addColorStop(1, '#182d28c7');
    ctx.fillStyle = imageFade;
    ctx.fillRect(60, 565, 780, 85);
    ctx.fillStyle = '#fff6e8';
    ctx.font = '700 23px ' + sans;
    ctx.fillText(city.landmark, 81, 624);
    ctx.save();
    ctx.translate(765, 185);
    ctx.rotate(.2);
    ctx.fillStyle = '#faeedadd';
    ctx.strokeStyle = city.color;
    for (const radius of [48, 42]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      if (radius === 48) ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = city.color;
    ctx.textAlign = 'center';
    ctx.font = '700 18px ' + sans;
    ctx.fillText('抵 达', 0, -3);
    ctx.font = '700 25px ' + sans;
    ctx.fillText('✳', 0, 25);
    ctx.restore();

    ctx.fillStyle = '#53635a';
    ctx.font = '24px ' + sans;
    ctx.fillText('我的灵魂老家', 60, 709);
    ctx.fillStyle = city.color;
    ctx.font = '900 126px ' + serif;
    ctx.fillText(city.name, 54, 836);
    ctx.font = '700 25px monospace';
    ctx.fillText(city.roman, 64, 877);
    ctx.fillStyle = city.shade;
    ctx.fillRect(626, 736, 214, 130);
    ctx.strokeStyle = city.color;
    ctx.strokeRect(626.5, 736.5, 213, 129);
    ctx.fillStyle = city.color;
    ctx.textAlign = 'center';
    ctx.font = '700 64px monospace';
    ctx.fillText(match + '%', 733, 803);
    ctx.font = '700 22px ' + sans;
    ctx.fillText('趣味匹配指数', 733, 840);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#aa9d84';
    ctx.setLineDash([8, 8]);
    for (const y of [908, 1229]) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(840, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#24382f';
    ctx.font = '700 35px ' + serif;
    printQuote(ctx, '“' + city.quote + '”', 60, 972, 765);
    ctx.fillStyle = city.color;
    ctx.font = '700 29px ' + sans;
    ctx.fillText(city.persona, 60, 1094);
    ctx.font = '21px ' + sans;
    let tagX = 60;
    for (const tag of city.tags) {
      const width = ctx.measureText(tag).width + 32;
      ctx.fillStyle = city.shade;
      ctx.fillRect(tagX, 1119, width, 41);
      ctx.fillStyle = '#24382f';
      ctx.fillText(tag, tagX + 16, 1147);
      tagX += width + 12;
    }
    ctx.fillStyle = '#53635a';
    ctx.font = '22px ' + sans;
    ctx.fillText('城市搭档 · ' + partner.name, 60, 1199);
    ctx.fillText('你的灵魂老家在哪座城市？', 60, 1273);
    ctx.textAlign = 'right';
    ctx.font = '19px ' + sans;
    ctx.fillText('趣味人格测试 · 仅供娱乐', 840, 1273);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Poster export failed')), 'image/png');
    });
  }

  async function savePoster() {
    const save = get('save');
    const currentResult = result;
    save.disabled = true;
    set('save-text', '正在制作海报…');
    set('save-status', '');
    try {
      if (!posterUrl) {
        const blob = await renderPoster(currentResult);
        if (result !== currentResult || get('result').hidden) return;
        posterUrl = URL.createObjectURL(blob);
      }
      const link = get('download-poster');
      link.href = posterUrl;
      link.download = '灵魂旅行局-' + currentResult.city.name + '.png';
      if (/iPad|iPhone|iPod|MicroMessenger|QQ\//i.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        get('poster-preview').src = posterUrl;
        get('poster-dialog').showModal();
      } else {
        link.click();
        set('save-status', '已生成 PNG 海报，请在浏览器下载中查看。');
      }
    } catch {
      set('save-status', '海报生成失败，请再试一次，也可以截取页面上的明信片。');
    } finally {
      save.disabled = false;
      set('save-text', '保存结果海报');
    }
  }

  get('question-form').addEventListener('change', (event) => {
    if (event.target.name !== 'answer') return;
    trip.answers[trip.index] = Number(event.target.value);
    get('next').disabled = false;
    persist();
    updateProgress();
  });
  get('question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (trip.answers[trip.index] === null) return;
    if (trip.index < questions.length - 1) {
      trip.index += 1;
      persist();
      showQuestion();
    } else {
      trip.finished = true;
      persist();
      showResult();
    }
  });
  get('back').addEventListener('click', () => {
    if (trip.index === 0) {
      showHome();
    } else {
      trip.index -= 1;
      persist();
      showQuestion();
    }
  });
  get('start').addEventListener('click', () => trip.finished ? showResult() : showQuestion());
  get('start-over').addEventListener('click', resetTrip);
  get('restart').addEventListener('click', resetTrip);
  get('about-button').addEventListener('click', () => get('about-dialog').showModal());
  get('save').addEventListener('click', savePoster);
  set('total-number', questions.length);
  get('progress').max = questions.length;
  showHome(false);
})();

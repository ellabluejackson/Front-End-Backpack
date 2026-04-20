// lofi playlist logic using youtube iframe player api -yr

const lofiOriginalPlaylist = [
  { id: '8JqTrT1MYrQ', title: 'Lofi Track 1' },
  { id: 'oZH-BcCb_7Q', title: 'Lofi Track 2' },
  { id: 'DsCJRBpfNtA', title: 'Lofi Track 3' },
  { id: 'vWqmPi6yf9I', title: 'Lofi Track 4' },
  { id: 'D1UNXgJTD7Y', title: 'Lofi Track 5' },
  { id: '7_xJRJ0Z-pA', title: 'Lofi Track 6' },
  { id: 'RCWmw8T-lag', title: 'Lofi Track 7' },
  { id: 'nyjg1V150BY', title: 'Lofi Track 8' },
  { id: 'WuS8mUssmKA', title: 'Lofi Track 9' },
  { id: 'EhCTDvW55fU', title: 'Lofi Track 10' }
];

const lofiPlaylist = [...lofiOriginalPlaylist];

let lofiPlayer = null;
let currentTrack = 0;
let isLofiPlaying = false;
let isShuffled = false;

// load the youtube iframe api script -yr
function loadYTAPI() {
  if (window.YT && window.YT.Player) {
    initLofiPlayer();
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = function() {
    showLofiError('Could not load music player. Check your internet connection.');
  };
  document.head.appendChild(tag);
}

function showLofiError(msg) {
  const titleEl = document.getElementById('lofiTrackTitle');
  if (titleEl) titleEl.textContent = msg;
  const playBtn = document.getElementById('lofiPlayBtn');
  if (playBtn) { playBtn.disabled = true; playBtn.title = msg; }
}

// youtube api calls this globally when ready -yr
function onYouTubeIframeAPIReady() {
  initLofiPlayer();
}

function initLofiPlayer() {
  lofiPlayer = new YT.Player('lofi-yt-player', {
    height: '0',
    width: '0',
    videoId: lofiPlaylist[currentTrack].id,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: onLofiPlayerReady,
      onStateChange: onLofiStateChange,
      onError: function() { showLofiError('Playback unavailable for this track.'); }
    }
  });
}

function onLofiPlayerReady() {
  renderTracklist();
  updateLofiUI();
  updateShuffleBtnState();
}

function onLofiStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    playNextTrack();
  }
  isLofiPlaying = event.data === YT.PlayerState.PLAYING;
  updateLofiUI();
}

// playback controls (the ui will call these) -yr

function playLofi() {
  if (!lofiPlayer) return;
  lofiPlayer.playVideo();
  isLofiPlaying = true;
}

function pauseLofi() {
  if (!lofiPlayer) return;
  lofiPlayer.pauseVideo();
  isLofiPlaying = false;
}

function toggleLofi() {
  isLofiPlaying ? pauseLofi() : playLofi();
}

function playNextTrack() {
  currentTrack = (currentTrack + 1) % lofiPlaylist.length;
  loadAndPlay(currentTrack);
}

function playPrevTrack() {
  currentTrack = (currentTrack - 1 + lofiPlaylist.length) % lofiPlaylist.length;
  loadAndPlay(currentTrack);
}

function playTrackByIndex(index) {
  if (index < 0 || index >= lofiPlaylist.length) return;
  currentTrack = index;
  loadAndPlay(currentTrack);
}

function loadAndPlay(index) {
  if (!lofiPlayer) return;
  lofiPlayer.loadVideoById(lofiPlaylist[index].id);
  isLofiPlaying = true;
  updateLofiUI();
}

function shufflePlaylist() {
  const shuffled = [...lofiOriginalPlaylist];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  lofiPlaylist.length = 0;
  shuffled.forEach(t => lofiPlaylist.push(t));
  isShuffled = true;
}

function unshufflePlaylist() {
  lofiPlaylist.length = 0;
  lofiOriginalPlaylist.forEach(t => lofiPlaylist.push(t));
  isShuffled = false;
}

function getCurrentTrackInfo() {
  return {
    index: currentTrack,
    total: lofiPlaylist.length,
    ...lofiPlaylist[currentTrack],
    isPlaying: isLofiPlaying
  };
}

// -- ui stuff --

// build the tracklist rows once -yr
function renderTracklist() {
  const list = document.getElementById('lofiTracklist');
  if (!list) return;
  list.innerHTML = '';
  lofiPlaylist.forEach(function(track, i) {
    const row = document.createElement('div');
    row.className = 'lofi-track-row' + (i === currentTrack ? ' active' : '');
    row.setAttribute('data-index', i);
    row.innerHTML =
      '<span class="lofi-track-num">' + (i + 1) + '</span>' +
      '<span class="lofi-track-name">' + track.title + '</span>' +
      '<span class="lofi-track-eq">♪</span>';
    row.addEventListener('click', function() {
      playTrackByIndex(i);
    });
    list.appendChild(row);
  });
}

// keep the ui in sync with player state -yr
function updateLofiUI() {
  var titleEl = document.getElementById('lofiTrackTitle');
  var playBtn = document.getElementById('lofiPlayBtn');
  var vinyl   = document.getElementById('lofiVinyl');
  var rows    = document.querySelectorAll('.lofi-track-row');

  if (titleEl) titleEl.textContent = lofiPlaylist[currentTrack].title;
  if (playBtn) playBtn.textContent = isLofiPlaying ? '⏸️' : '▶️';
  if (vinyl) {
    isLofiPlaying ? vinyl.classList.add('spinning') : vinyl.classList.remove('spinning');
  }

  rows.forEach(function(row, i) {
    row.classList.toggle('active', i === currentTrack);
  });
}

// button handlers called from the html -yr
function handlePlayPause() {
  toggleLofi();
}

function handleNext() {
  playNextTrack();
}

function handlePrev() {
  playPrevTrack();
}

function handleShuffle() {
  if (isShuffled) {
    unshufflePlaylist();
  } else {
    shufflePlaylist();
  }
  currentTrack = 0;
  renderTracklist();
  updateShuffleBtnState();
  loadAndPlay(0);
}

function updateShuffleBtnState() {
  const btn = document.querySelector('.lofi-ctrl[onclick="handleShuffle()"]');
  if (btn) btn.style.opacity = isShuffled ? '1' : '0.5';
}

// start when the dom is ready -yr
document.addEventListener('DOMContentLoaded', loadYTAPI);

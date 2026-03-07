// lofi playlist logic using youtube iframe player api -yr

const lofiPlaylist = [
  { id: '8JqTrT1MYrQ', title: 'Lofi Track 1' },
  { id: 'oZH-BcCb_7Q', title: 'Lofi Track 2' },
  { id: 'DsCJRBpfNtA', title: 'Lofi Track 3' },
  { id: 'n61ULEU7CO0', title: 'Lofi Track 4' },
  { id: '84u41t5v4j4', title: 'Lofi Track 5' },
  { id: 'f7Dfv4NSEjg', title: 'Lofi Track 6' },
  { id: '-XTRvGmtkHg', title: 'Lofi Track 7' },
  { id: 'elZbdo-i8yE', title: 'Lofi Track 8' },
  { id: 'Z1oUGthAzeo', title: 'Lofi Track 9' },
  { id: 'F_RPm8eSU-g', title: 'Lofi Track 10' }
];

let lofiPlayer = null;
let currentTrack = 0;
let isLofiPlaying = false;

// load the youtube iframe api script -yr
function loadYTAPI() {
  if (window.YT && window.YT.Player) {
    initLofiPlayer();
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
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
      onStateChange: onLofiStateChange
    }
  });
}

function onLofiPlayerReady() {
  console.log('lofi player ready — track:', lofiPlaylist[currentTrack].title);
  renderTracklist();
  updateLofiUI();
}

function onLofiStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    playNextTrack();
  }
  isLofiPlaying = event.data === YT.PlayerState.PLAYING;
  updateLofiUI();
}

// playback controls — the ui will call these -yr

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
  // shuffle -yr
  for (let i = lofiPlaylist.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lofiPlaylist[i], lofiPlaylist[j]] = [lofiPlaylist[j], lofiPlaylist[i]];
  }
  currentTrack = 0;
  console.log('playlist shuffled');
}

function getCurrentTrackInfo() {
  return {
    index: currentTrack,
    total: lofiPlaylist.length,
    ...lofiPlaylist[currentTrack],
    isPlaying: isLofiPlaying
  };
}

// -- ui stuff -yr --

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
  shufflePlaylist();
  renderTracklist();
  loadAndPlay(0);
}

// start when the dom is ready -yr
document.addEventListener('DOMContentLoaded', loadYTAPI);


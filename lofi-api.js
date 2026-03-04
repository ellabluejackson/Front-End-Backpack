// lofi playlist logic using youtube iframe player api -yr

const lofiPlaylist = [
  { id: '8JqTrT1MYrQ', title: 'Lofi Track 1' },
  { id: 'oZH-BcCb_7Q', title: 'Lofi Track 2' },
  { id: 'DsCJRBpfNtA', title: 'Lofi Track 3' },
  { id: 'n61ULEU7CO0', title: 'Lofi Track 4' },
  { id: '84u41t5v4j4', title: 'Lofi Track 5' },
  { id: 'f7Dfv4NSEjg', title: 'Lofi Track 6' },
  { id: 'QteOIIYe8VA', title: 'Lofi Track 7' },
  { id: 'mpWlW5_RPZ4', title: 'Lofi Track 8' },
  { id: 'm0Tve24ezNQ', title: 'Lofi Track 9' },
  { id: 'UUXucbnkQBs', title: 'Lofi Track 10' }
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
  // player is ready, ui can enable controls whenever it's built -yr
  console.log('lofi player ready — track:', lofiPlaylist[currentTrack].title);
}

function onLofiStateChange(event) {
  // when a video ends, go to the next track -yr
  if (event.data === YT.PlayerState.ENDED) {
    playNextTrack();
  }
  // keep our state in sync -yr
  isLofiPlaying = event.data === YT.PlayerState.PLAYING;
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
  console.log('now playing:', lofiPlaylist[index].title);
}

function shufflePlaylist() {
  // fisher-yates shuffle -yr
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

// kick things off when the dom is ready -yr
document.addEventListener('DOMContentLoaded', loadYTAPI);


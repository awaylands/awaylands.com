import ko from 'knockout';
import DriveIn from 'drive-in';

const init = function (element, valueAccessor) {
  const value = valueAccessor();

  const driveIn = new DriveIn();

  const driveInOpts = {
    mute: value.mute,
    loop: value.loop,
    poster: {
      src: value.poster
    }
  };

  driveIn.init({el: element});

  const togglePlay = value.togglePlay;

  if (togglePlay && ko.isObservable(togglePlay)) {
    togglePlay.subscribe(val => {
      if (val) {
        driveIn.play();
      } else {
        driveIn.pause();
      }
    });

    if (!togglePlay()) {
      driveInOpts.startPaused = true;
    }
  }

  driveIn.show(value.videos, driveInOpts);

  ko.utils.domNodeDisposal.addDisposeCallback(element, driveIn.close);
};

export default {init};

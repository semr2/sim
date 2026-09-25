(() => {
  'use strict';
  
  // Basic SCORM API wrapper
  window.scorm = {
    isActive: false,
    init: function() {
      try {
        if (window.parent && window.parent.API && window.parent.API.LMSInitialize) {
          this.isActive = window.parent.API.LMSInitialize('') === 'true';
        }
      } catch (e) {
        console.log('SCORM API not available');
      }
    },
    setScore: function(score, max, min) {
      try {
        if (this.isActive && window.parent.API) {
          window.parent.API.LMSSetValue('cmi.score.raw', score);
          window.parent.API.LMSSetValue('cmi.score.max', max);
          window.parent.API.LMSSetValue('cmi.score.min', min);
        }
      } catch (e) {
        console.log('Error setting score');
      }
    },
    complete: function(status) {
      try {
        if (this.isActive && window.parent.API) {
          window.parent.API.LMSSetValue('cmi.core.lesson_status', status);
          window.parent.API.LMSCommit('');
          window.parent.API.LMSFinish('');
        }
      } catch (e) {
        console.log('Error completing course');
      }
    }
  };
})();

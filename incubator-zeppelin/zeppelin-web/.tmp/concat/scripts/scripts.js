/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
(function() {
    var zeppelinWebApp = angular.module('zeppelinWebApp', [
            'ngCookies',
            'ngAnimate',
            'ngRoute',
            'ngSanitize',
            'angular-websocket',
            'ui.ace',
            'ui.bootstrap',
            'as.sortable',
            'ngTouch',
            'ngDragDrop',
            'angular.filter',
            'monospaced.elastic',
            'puElasticInput',
            'xeditable',
            'ngToast',
            'focus-if',
            'ngResource'
        ])
        .filter('breakFilter', function() {
            return function (text) {
                if (!!text) {
                    return text.replace(/\n/g, '<br />');
                }
            };
        })
        .config(["$httpProvider", "$routeProvider", "ngToastProvider", function ($httpProvider, $routeProvider, ngToastProvider) {
            // withCredentials when running locally via grunt
            $httpProvider.defaults.withCredentials = true;

            $routeProvider
                .when('/', {
                    templateUrl: 'app/home/home.html'
                })
                .when('/notebook/:noteId', {
                    templateUrl: 'app/notebook/notebook.html',
                    controller: 'NotebookCtrl'
                })
                .when('/notebook/:noteId/paragraph?=:paragraphId', {
                    templateUrl: 'app/notebook/notebook.html',
                    controller: 'NotebookCtrl'
                })
                .when('/notebook/:noteId/paragraph/:paragraphId?', {
                    templateUrl: 'app/notebook/notebook.html',
                    controller: 'NotebookCtrl'
                })
                .when('/interpreter', {
                    templateUrl: 'app/interpreter/interpreter.html',
                    controller: 'InterpreterCtrl'
                })
                .when('/configuration', {
                  templateUrl: 'app/configuration/configuration.html',
                  controller: 'ConfigurationCtrl'
                })
                .when('/search/:searchTerm', {
                    templateUrl: 'app/search/result-list.html',
                    controller: 'SearchResultCtrl'
                })
                .otherwise({
                    redirectTo: '/'
                });

            ngToastProvider.configure({
                dismissButton: true,
                dismissOnClick: false,
                timeout: 6000
            });
        }]);


    function auth() {
        var $http = angular.injector(['ng']).get('$http');
        var baseUrlSrv = angular.injector(['zeppelinWebApp']).get('baseUrlSrv');
        // withCredentials when running locally via grunt
        $http.defaults.withCredentials = true;

        return $http.get(baseUrlSrv.getRestApiBase()+'/security/ticket').then(function(response) {
            zeppelinWebApp.run(["$rootScope", function($rootScope) {
                $rootScope.ticket = angular.fromJson(response.data).body;
            }]);
        }, function(errorResponse) {
            // Handle error case
        });
    }

    function bootstrapApplication() {
        angular.bootstrap(document, ['zeppelinWebApp']);
    }


    angular.element(document).ready(function() {
        auth().then(bootstrapApplication);
    });

}());


/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').controller('MainCtrl', ["$scope", "$rootScope", "$window", function($scope, $rootScope, $window) {
  $scope.looknfeel = 'default';

  var init = function() {
    $scope.asIframe = (($window.location.href.indexOf('asIframe') > -1) ? true : false);
  };

  init();

  $rootScope.$on('setIframe', function(event, data) {
    if (!event.defaultPrevented) {
      $scope.asIframe = data;
      event.preventDefault();
    }
  });

  $rootScope.$on('setLookAndFeel', function(event, data) {
    if (!event.defaultPrevented && data && data !== '' && data !== $scope.looknfeel) {
      $scope.looknfeel = data;
      event.preventDefault();
    }
  });

  // Set The lookAndFeel to default on every page
  $rootScope.$on('$routeChangeStart', function(event, next, current) {
    $rootScope.$broadcast('setLookAndFeel', 'default');
  });

  BootstrapDialog.defaultOptions.onshown = function() {
    angular.element('#' + this.id).find('.btn:last').focus();
  };
}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').controller('HomeCtrl', ["$scope", "notebookListDataFactory", "websocketMsgSrv", "$rootScope", "arrayOrderingSrv", "$http", "baseUrlSrv", function($scope, notebookListDataFactory, websocketMsgSrv, $rootScope, arrayOrderingSrv, $http, baseUrlSrv) {
  var vm = this;
  vm.notes = notebookListDataFactory;
  vm.websocketMsgSrv = websocketMsgSrv;
  vm.arrayOrderingSrv = arrayOrderingSrv;

  vm.notebookHome = false;
  if ($rootScope.ticket !== undefined) {
    vm.staticHome = false;
  } else {
    vm.staticHome = true;
  }

  $scope.isReloading = false;

  var getZeppelinVersion = function() {
    $http.get(baseUrlSrv.getRestApiBase() +'/version').
      success(function (data, status, headers, config) {
        $scope.zeppelinVersion = data.body;
      }).
      error(function(data, status, headers, config) {
        console.log('Error %o %o', status, data.message);
      });
  };
  
  var initHome = function() {
    websocketMsgSrv.getHomeNotebook();
    getZeppelinVersion();
  };

  initHome();

  $scope.$on('setNoteContent', function(event, note) {
    if (note) {
      vm.note = note;

      // initialize look And Feel
      $rootScope.$broadcast('setLookAndFeel', 'home');

      // make it read only
      vm.viewOnly = true;

      vm.notebookHome = true;
      vm.staticHome = false;
    } else {
      vm.staticHome = true;
      vm.notebookHome = false;
    }
  });

  $scope.$on('setNoteMenu', function(event, notes) {
    $scope.isReloadingNotes = false;
  });

  $scope.reloadNotebookList = function() {
    websocketMsgSrv.reloadAllNotesFromRepo();
    $scope.isReloadingNotes = true;
  };

  $scope.toggleFolderNode = function(node) {
    node.hidden = !node.hidden;
  };

}]);

/* jshint loopfunc: true */
/* global $: false */
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').controller('NotebookCtrl',
  ["$scope", "$route", "$routeParams", "$location", "$rootScope", "$http", "websocketMsgSrv", "baseUrlSrv", "$timeout", "SaveAsService", function($scope, $route, $routeParams, $location, $rootScope, $http,
    websocketMsgSrv, baseUrlSrv, $timeout, SaveAsService) {
  $scope.note = null;
  $scope.showEditor = false;
  $scope.editorToggled = false;
  $scope.tableToggled = false;
  $scope.viewOnly = false;
  $scope.showSetting = false;
  $scope.looknfeelOption = [ 'default', 'simple', 'report'];
  $scope.cronOption = [
    {name: 'None', value : undefined},
    {name: '1m', value: '0 0/1 * * * ?'},
    {name: '5m', value: '0 0/5 * * * ?'},
    {name: '1h', value: '0 0 0/1 * * ?'},
    {name: '3h', value: '0 0 0/3 * * ?'},
    {name: '6h', value: '0 0 0/6 * * ?'},
    {name: '12h', value: '0 0 0/12 * * ?'},
    {name: '1d', value: '0 0 0 * * ?'}
  ];

  $scope.interpreterSettings = [];
  $scope.interpreterBindings = [];
  $scope.isNoteDirty = null;
  $scope.saveTimer = null;

  var connectedOnce = false;

  $scope.$on('setConnectedStatus', function(event, param) {
    if(connectedOnce && param){
      initNotebook();
    }
    connectedOnce = true;
  });

  $scope.getCronOptionNameFromValue = function(value) {
    if (!value) {
      return '';
    }

    for (var o in $scope.cronOption) {
      if ($scope.cronOption[o].value===value) {
        return $scope.cronOption[o].name;
      }
    }
    return value;
  };

  /** Init the new controller */
  var initNotebook = function() {
    websocketMsgSrv.getNotebook($routeParams.noteId);

    var currentRoute = $route.current;

    if (currentRoute) {
      setTimeout(
        function() {
          var routeParams = currentRoute.params;
          var $id = $('#' + routeParams.paragraph + '_container');

          if ($id.length > 0) {
            // adjust for navbar
            var top = $id.offset().top - 103;
            $('html, body').scrollTo({top: top, left: 0});
          }

        },
        1000
      );
    }
  };

  initNotebook();


  $scope.focusParagraphOnClick = function(clickEvent) {
    if (!$scope.note) {
      return;
    }
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      var paragraphId = $scope.note.paragraphs[i].id;
      if (jQuery.contains(angular.element('#' + paragraphId + '_container')[0], clickEvent.target)) {
        $scope.$broadcast('focusParagraph', paragraphId, 0, true);
        break;
      }
    }
  };

  // register mouseevent handler for focus paragraph
  document.addEventListener('click', $scope.focusParagraphOnClick);

  $scope.keyboardShortcut = function(keyEvent) {
    // handle keyevent
    if (!$scope.viewOnly) {
      $scope.$broadcast('keyEvent', keyEvent);
    }
  };

  // register mouseevent handler for focus paragraph
  document.addEventListener('keydown', $scope.keyboardShortcut);


  /** Remove the note and go back tot he main page */
  /** TODO(anthony): In the nearly future, go back to the main page and telle to the dude that the note have been remove */
  $scope.removeNote = function(noteId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to delete this notebook?',
      callback: function(result) {
        if (result) {
          websocketMsgSrv.deleteNotebook(noteId);
          $location.path('/#');
        }
      }
    });
  };

  //Export notebook
  $scope.exportNotebook = function() {
    var jsonContent = JSON.stringify($scope.note);
    SaveAsService.SaveAs(jsonContent, $scope.note.name, 'json');
  };

  //Clone note
  $scope.cloneNote = function(noteId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to clone this notebook?',
      callback: function(result) {
        if (result) {
          websocketMsgSrv.cloneNotebook(noteId);
          $location.path('/#');
        }
      }
    });
  };

  // checkpoint/commit notebook
  $scope.checkpointNotebook = function(commitMessage) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Commit notebook to current repository?',
      callback: function(result) {
        if (result) {
          websocketMsgSrv.checkpointNotebook($routeParams.noteId, commitMessage);
        }
      }
    });
    document.getElementById('note.checkpoint.message').value='';
  };

  $scope.runNote = function() {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Run all paragraphs?',
      callback: function(result) {
        if (result) {
          _.forEach($scope.note.paragraphs, function (n, key) {
            angular.element('#' + n.id + '_paragraphColumn_main').scope().runParagraph(n.text);
          });
        }
      }
    });
  };

  $scope.saveNote = function() {
    if ($scope.note && $scope.note.paragraphs) {
      _.forEach($scope.note.paragraphs, function(n, key) {
        angular.element('#' + n.id + '_paragraphColumn_main').scope().saveParagraph();
      });
      $scope.isNoteDirty = null;
    }
  };

  $scope.clearAllParagraphOutput = function() {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to clear all output?',
      callback: function(result) {
        if (result) {
          _.forEach($scope.note.paragraphs, function(n, key) {
            angular.element('#' + n.id + '_paragraphColumn_main').scope().clearParagraphOutput();
          });
        }
      }
    });
  };

  $scope.toggleAllEditor = function() {
    if ($scope.editorToggled) {
      $scope.$broadcast('openEditor');
    } else {
      $scope.$broadcast('closeEditor');
    }
    $scope.editorToggled = !$scope.editorToggled;
  };

  $scope.showAllEditor = function() {
    $scope.$broadcast('openEditor');
  };

  $scope.hideAllEditor = function() {
    $scope.$broadcast('closeEditor');
  };

  $scope.toggleAllTable = function() {
    if ($scope.tableToggled) {
      $scope.$broadcast('openTable');
    } else {
      $scope.$broadcast('closeTable');
    }
    $scope.tableToggled = !$scope.tableToggled;
  };

  $scope.showAllTable = function() {
    $scope.$broadcast('openTable');
  };

  $scope.hideAllTable = function() {
    $scope.$broadcast('closeTable');
  };

  $scope.isNoteRunning = function() {
    var running = false;
    if(!$scope.note){ return false; }
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ( $scope.note.paragraphs[i].status === 'PENDING' || $scope.note.paragraphs[i].status === 'RUNNING') {
        running = true;
        break;
      }
    }
    return running;
  };

  $scope.killSaveTimer = function() {
    if ($scope.saveTimer) {
      $timeout.cancel($scope.saveTimer);
      $scope.saveTimer = null;
    }
  };

  $scope.startSaveTimer = function() {
    $scope.killSaveTimer();
    $scope.isNoteDirty = true;
    //console.log('startSaveTimer called ' + $scope.note.id);
    $scope.saveTimer = $timeout(function(){
      $scope.saveNote();
    }, 10000);
  };

  angular.element(window).on('beforeunload', function(e) {
    $scope.killSaveTimer();
    $scope.saveNote();
  });

  $scope.$on('$destroy', function() {
    angular.element(window).off('beforeunload');
    $scope.killSaveTimer();
    $scope.saveNote();

    document.removeEventListener('click', $scope.focusParagraphOnClick);
    document.removeEventListener('keydown', $scope.keyboardShortcut);
  });

  $scope.setLookAndFeel = function(looknfeel) {
    $scope.note.config.looknfeel = looknfeel;
    $scope.setConfig();
  };

  /** Set cron expression for this note **/
  $scope.setCronScheduler = function(cronExpr) {
    $scope.note.config.cron = cronExpr;
    $scope.setConfig();
  };

  /** Set release resource for this note **/
  $scope.setReleaseResource = function(value) {
    $scope.note.config.releaseresource = value;
    $scope.setConfig();
  };

  /** Update note config **/
  $scope.setConfig = function(config) {
    if(config) {
      $scope.note.config = config;
    }
    websocketMsgSrv.updateNotebook($scope.note.id, $scope.note.name, $scope.note.config);
  };

  /** Update the note name */
  $scope.sendNewName = function() {
    if ($scope.note.name) {
      websocketMsgSrv.updateNotebook($scope.note.id, $scope.note.name, $scope.note.config);
    }
  };

  /** update the current note */
  $scope.$on('setNoteContent', function(event, note) {
    $scope.paragraphUrl = $routeParams.paragraphId;
    $scope.asIframe = $routeParams.asIframe;
    if ($scope.paragraphUrl) {
      note = cleanParagraphExcept($scope.paragraphUrl, note);
      $rootScope.$broadcast('setIframe', $scope.asIframe);
    }

    if ($scope.note === null) {
      $scope.note = note;
    } else {
      updateNote(note);
    }
    initializeLookAndFeel();
    //open interpreter binding setting when there're none selected
    getInterpreterBindings(getInterpreterBindingsCallBack);
  });


  var initializeLookAndFeel = function() {
    if (!$scope.note.config.looknfeel) {
      $scope.note.config.looknfeel = 'default';
    } else {
      $scope.viewOnly = $scope.note.config.looknfeel === 'report' ? true : false;
    }
    $rootScope.$broadcast('setLookAndFeel', $scope.note.config.looknfeel);
  };

  var cleanParagraphExcept = function(paragraphId, note) {
    var noteCopy = {};
    noteCopy.id = note.id;
    noteCopy.name = note.name;
    noteCopy.config = note.config;
    noteCopy.info = note.info;
    noteCopy.paragraphs = [];
    for (var i=0; i<note.paragraphs.length; i++) {
      if (note.paragraphs[i].id === paragraphId) {
        noteCopy.paragraphs[0] = note.paragraphs[i];
        if (!noteCopy.paragraphs[0].config) {
          noteCopy.paragraphs[0].config = {};
        }
        noteCopy.paragraphs[0].config.editorHide = true;
        noteCopy.paragraphs[0].config.tableHide = false;
        break;
      }
    }
    return noteCopy;
  };

  // create new paragraph on current position
  $scope.$on('insertParagraph', function(event, paragraphId, position) {
    var newIndex = -1;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ( $scope.note.paragraphs[i].id === paragraphId ) {
        //determine position of where to add new paragraph; default is below
        if ( position === 'above' ) {
          newIndex = i;
        } else {
          newIndex = i+1;
        }
        break;
      }
    }

    if (newIndex < 0 || newIndex > $scope.note.paragraphs.length) {
      return;
    }
    websocketMsgSrv.insertParagraph(newIndex);
  });

  $scope.$on('moveParagraphUp', function(event, paragraphId) {
    var newIndex = -1;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ($scope.note.paragraphs[i].id === paragraphId) {
        newIndex = i-1;
        break;
      }
    }
    if (newIndex<0 || newIndex>=$scope.note.paragraphs.length) {
      return;
    }
    // save dirtyText of moving paragraphs.
    var prevParagraphId = $scope.note.paragraphs[newIndex].id;
    angular.element('#' + paragraphId + '_paragraphColumn_main').scope().saveParagraph();
    angular.element('#' + prevParagraphId + '_paragraphColumn_main').scope().saveParagraph();
    websocketMsgSrv.moveParagraph(paragraphId, newIndex);
  });

  $scope.$on('moveParagraphDown', function(event, paragraphId) {
    var newIndex = -1;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ($scope.note.paragraphs[i].id === paragraphId) {
        newIndex = i+1;
        break;
      }
    }

    if (newIndex<0 || newIndex>=$scope.note.paragraphs.length) {
      return;
    }
    // save dirtyText of moving paragraphs.
    var nextParagraphId = $scope.note.paragraphs[newIndex].id;
    angular.element('#' + paragraphId + '_paragraphColumn_main').scope().saveParagraph();
    angular.element('#' + nextParagraphId + '_paragraphColumn_main').scope().saveParagraph();
    websocketMsgSrv.moveParagraph(paragraphId, newIndex);
  });

  $scope.$on('moveFocusToPreviousParagraph', function(event, currentParagraphId){
    var focus = false;
    for (var i=$scope.note.paragraphs.length-1; i>=0; i--) {
      if (focus === false ) {
        if ($scope.note.paragraphs[i].id === currentParagraphId) {
          focus = true;
          continue;
        }
      } else {
        $scope.$broadcast('focusParagraph', $scope.note.paragraphs[i].id, -1);
        break;
      }
    }
  });

  $scope.$on('moveFocusToNextParagraph', function(event, currentParagraphId){
    var focus = false;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if (focus === false ) {
        if ($scope.note.paragraphs[i].id === currentParagraphId) {
          focus = true;
          continue;
        }
      } else {
        $scope.$broadcast('focusParagraph', $scope.note.paragraphs[i].id, 0);
        break;
      }
    }
  });

  var updateNote = function(note) {
    /** update Note name */
    if (note.name !== $scope.note.name) {
      console.log('change note name: %o to %o', $scope.note.name, note.name);
      $scope.note.name = note.name;
    }

    $scope.note.config = note.config;
    $scope.note.info = note.info;

    var newParagraphIds = note.paragraphs.map(function(x) {return x.id;});
    var oldParagraphIds = $scope.note.paragraphs.map(function(x) {return x.id;});

    var numNewParagraphs = newParagraphIds.length;
    var numOldParagraphs = oldParagraphIds.length;

    var paragraphToBeFocused;
    var focusedParagraph;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      var paragraphId = $scope.note.paragraphs[i].id;
      if (angular.element('#' + paragraphId + '_paragraphColumn_main').scope().paragraphFocused) {
        focusedParagraph = paragraphId;
        break;
      }
    }

    /** add a new paragraph */
    if (numNewParagraphs > numOldParagraphs) {
      for (var index in newParagraphIds) {
        if (oldParagraphIds[index] !== newParagraphIds[index]) {
          $scope.note.paragraphs.splice(index, 0, note.paragraphs[index]);
          paragraphToBeFocused = note.paragraphs[index].id;
          break;
        }
        $scope.$broadcast('updateParagraph', {
          note: $scope.note, // pass the note object to paragraph scope
          paragraph: note.paragraphs[index]});
      }
    }

    /** update or move paragraph */
    if (numNewParagraphs === numOldParagraphs) {
      for (var idx in newParagraphIds) {
        var newEntry = note.paragraphs[idx];
        if (oldParagraphIds[idx] === newParagraphIds[idx]) {
          $scope.$broadcast('updateParagraph', {
            note: $scope.note, // pass the note object to paragraph scope
            paragraph: newEntry});
        } else {
          // move paragraph
          var oldIdx = oldParagraphIds.indexOf(newParagraphIds[idx]);
          $scope.note.paragraphs.splice(oldIdx, 1);
          $scope.note.paragraphs.splice(idx, 0, newEntry);
          // rebuild id list since paragraph has moved.
          oldParagraphIds = $scope.note.paragraphs.map(function(x) {return x.id;});
        }

        if (focusedParagraph === newParagraphIds[idx]) {
          paragraphToBeFocused = focusedParagraph;
        }
      }
    }

    /** remove paragraph */
    if (numNewParagraphs < numOldParagraphs) {
      for (var oldidx in oldParagraphIds) {
        if(oldParagraphIds[oldidx] !== newParagraphIds[oldidx]) {
          $scope.note.paragraphs.splice(oldidx, 1);
          break;
        }
      }
    }

    // restore focus of paragraph
    for (var f=0; f<$scope.note.paragraphs.length; f++) {
      if (paragraphToBeFocused === $scope.note.paragraphs[f].id) {
        $scope.note.paragraphs[f].focus = true;
      }
    }
  };

  var getInterpreterBindings = function(callback) {
    $http.get(baseUrlSrv.getRestApiBase()+ '/notebook/interpreter/bind/' +$scope.note.id).
    success(function(data, status, headers, config) {
      $scope.interpreterBindings = data.body;
      $scope.interpreterBindingsOrig = angular.copy($scope.interpreterBindings); // to check dirty
      if (callback) {
        callback();
      }
    }).
    error(function(data, status, headers, config) {
      if (status !== 0) {
        console.log('Error %o %o', status, data.message);
      }
    });
  };

  var getInterpreterBindingsCallBack = function() {
    var selected = false;
    var key;
    var setting;

    for (key in $scope.interpreterBindings) {
      setting = $scope.interpreterBindings[key];
      if (setting.selected) {
        selected = true;
        break;
      }
    }

    if (!selected) {
      // make default selection
      var selectedIntp = {};
      for (key in $scope.interpreterBindings) {
        setting = $scope.interpreterBindings[key];
        if (!selectedIntp[setting.group]) {
          setting.selected = true;
          selectedIntp[setting.group] = true;
        }
      }
      $scope.showSetting = true;
    }
  };

  $scope.interpreterSelectionListeners = {
    accept : function(sourceItemHandleScope, destSortableScope) {return true;},
    itemMoved: function (event) {},
    orderChanged: function(event) {}
  };

  $scope.openSetting = function() {
    $scope.showSetting = true;
    getInterpreterBindings();
  };

  $scope.closeSetting = function() {
    if (isSettingDirty()) {
      BootstrapDialog.confirm({
        closable: true,
        title: '',
        message: 'Changes will be discarded.',
        callback: function(result) {
          if (result) {
            $scope.$apply(function() {
              $scope.showSetting = false;
            });
          }
        }
      });
    } else {
      $scope.showSetting = false;
    }
  };

  $scope.saveSetting = function() {
    var selectedSettingIds = [];
    for (var no in $scope.interpreterBindings) {
      var setting = $scope.interpreterBindings[no];
      if (setting.selected) {
        selectedSettingIds.push(setting.id);
      }
    }

    $http.put(baseUrlSrv.getRestApiBase() + '/notebook/interpreter/bind/' + $scope.note.id,
              selectedSettingIds).
    success(function(data, status, headers, config) {
      console.log('Interpreter binding %o saved', selectedSettingIds);
      $scope.showSetting = false;
    }).
    error(function(data, status, headers, config) {
      console.log('Error %o %o', status, data.message);
    });
  };

  $scope.toggleSetting = function() {
    if ($scope.showSetting) {
      $scope.closeSetting();
    } else {
      $scope.openSetting();
    }
  };

  var getPermissions = function(callback) {
    $http.get(baseUrlSrv.getRestApiBase()+ '/notebook/' +$scope.note.id + '/permissions').
    success(function(data, status, headers, config) {
      $scope.permissions = data.body;
      $scope.permissionsOrig = angular.copy($scope.permissions); // to check dirty
      if (callback) {
        callback();
      }
    }).
    error(function(data, status, headers, config) {
      if (status !== 0) {
        console.log('Error %o %o', status, data.message);
      }
    });
  };

  $scope.openPermissions = function() {
    $scope.showPermissions = true;
    getPermissions();
  };


  $scope.closePermissions = function() {
    if (isPermissionsDirty()) {
      BootstrapDialog.confirm({
        closable: true,
        title: '',
        message: 'Changes will be discarded.',
        callback: function(result) {
          if (result) {
            $scope.$apply(function() {
              $scope.showPermissions = false;
            });
          }
        }
      });
    } else {
      $scope.showPermissions = false;
    }
  };

  $scope.savePermissions = function() {
    $http.put(baseUrlSrv.getRestApiBase() + '/notebook/' +$scope.note.id + '/permissions',
      $scope.permissions, {withCredentials: true}).
    success(function(data, status, headers, config) {
      console.log('Note permissions %o saved', $scope.permissions);
      $scope.showPermissions = false;
    }).
    error(function(data, status, headers, config) {
      console.log('Error %o %o', status, data.message);
      BootstrapDialog.alert({
        closable: true,
        title: 'Insufficient privileges',
        message: data.message
      });
    });
  };

  $scope.togglePermissions = function() {
    if ($scope.showPermissions) {
      $scope.closePermissions();
    } else {
      $scope.openPermissions();
    }
  };


  var isSettingDirty = function() {
    if (angular.equals($scope.interpreterBindings, $scope.interpreterBindingsOrig)) {
      return false;
    } else {
      return true;
    }
  };

  var isPermissionsDirty = function() {
    if (angular.equals($scope.permissions, $scope.permissionsOrig)) {
      return false;
    } else {
      return true;
    }
  };

}]);

/* jshint loopfunc: true */
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').controller('InterpreterCtrl', ["$scope", "$route", "$routeParams", "$location", "$rootScope", "$http", "baseUrlSrv", "ngToast", function($scope, $route, $routeParams, $location, $rootScope,
                                                                         $http, baseUrlSrv, ngToast) {
  var interpreterSettingsTmp = [];
  $scope.interpreterSettings = [];
  $scope.availableInterpreters = {};
  $scope.showAddNewSetting = false;
  $scope.showRepositoryInfo = false;
  $scope._ = _;

  var getInterpreterSettings = function() {
    $http.get(baseUrlSrv.getRestApiBase()+'/interpreter/setting').
      success(function(data, status, headers, config) {
        $scope.interpreterSettings = data.body;
      }).
      error(function(data, status, headers, config) {
        console.log('Error %o %o', status, data.message);
      });
  };

  var getAvailableInterpreters = function() {
    $http.get(baseUrlSrv.getRestApiBase()+'/interpreter').
      success(function(data, status, headers, config) {
        $scope.availableInterpreters = data.body;
      }).
      error(function(data, status, headers, config) {
        console.log('Error %o %o', status, data.message);
      });
  };

  var emptyNewProperty = function(object) {
    angular.extend(object, {propertyValue: '', propertyKey: ''});
  };

  var emptyNewDependency = function(object) {
    angular.extend(object, {depArtifact: '', depExclude: ''});
  };

  var removeTMPSettings = function(index) {
    interpreterSettingsTmp.splice(index, 1);
  };

  $scope.copyOriginInterpreterSettingProperties = function(settingId) {
    var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });
    interpreterSettingsTmp[index] = angular.copy($scope.interpreterSettings[index]);
  };

  $scope.setSessionOption = function(settingId, sessionOption) {
    var option;
    if (settingId === undefined) {
      option = $scope.newInterpreterSetting.option;
    } else {
      var index = _.findIndex($scope.interpreterSettings, {'id': settingId});
      var setting = $scope.interpreterSettings[index];
      option = setting.option;
    }

    if (sessionOption === 'isolated') {
      option.perNoteSession = false;
      option.perNoteProcess = true;
    } else if (sessionOption === 'scoped') {
      option.perNoteSession = true;
      option.perNoteProcess = false;
    } else {
      option.perNoteSession = false;
      option.perNoteProcess = false;
    }
  };

  $scope.getSessionOption = function(settingId) {
    var option;
    if (settingId === undefined) {
      option = $scope.newInterpreterSetting.option;
    } else {
      var index = _.findIndex($scope.interpreterSettings, {'id': settingId});
      var setting = $scope.interpreterSettings[index];
      option = setting.option;
    }

    if (option.perNoteSession) {
      return 'scoped';
    } else if (option.perNoteProcess) {
      return 'isolated';
    } else {
      return 'shared';
    }
  };

  $scope.updateInterpreterSetting = function(form, settingId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to update this interpreter and restart with new settings?',
      callback: function (result) {
        if (result) {
          var index = _.findIndex($scope.interpreterSettings, {'id': settingId});
          var setting = $scope.interpreterSettings[index];
          if (setting.propertyKey !== '' || setting.propertyKey) {
            $scope.addNewInterpreterProperty(settingId);
          }
          if (setting.depArtifact !== '' || setting.depArtifact) {
            $scope.addNewInterpreterDependency(settingId);
          }
          // add missing field of option
          if (!setting.option) {
            setting.option = {};
          }
          if (setting.option.remote === undefined) {
            // remote always true for now
            setting.option.remote = true;
          }
          var request = {
            option: angular.copy(setting.option),
            properties: angular.copy(setting.properties),
            dependencies: angular.copy(setting.dependencies)
          };

          $http.put(baseUrlSrv.getRestApiBase() + '/interpreter/setting/' + settingId, request).
            success(function (data, status, headers, config) {
              $scope.interpreterSettings[index] = data.body;
              removeTMPSettings(index);
            }).
            error(function (data, status, headers, config) {
              console.log('Error %o %o', status, data.message);
              ngToast.danger({content: data.message, verticalPosition: 'bottom'});
              form.$show();
            });
        }
      }
    });
  };

  $scope.resetInterpreterSetting = function(settingId){
    var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });

    // Set the old settings back
    $scope.interpreterSettings[index] = angular.copy(interpreterSettingsTmp[index]);
    removeTMPSettings(index);
  };

  $scope.removeInterpreterSetting = function(settingId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to delete this interpreter setting?',
      callback: function(result) {
        if (result) {
          $http.delete(baseUrlSrv.getRestApiBase() + '/interpreter/setting/' + settingId).
            success(function(data, status, headers, config) {

              var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });
              $scope.interpreterSettings.splice(index, 1);
            }).
            error(function(data, status, headers, config) {
              console.log('Error %o %o', status, data.message);
            });
        }
      }
    });
  };

  $scope.newInterpreterGroupChange = function() {
    var el = _.pluck(_.filter($scope.availableInterpreters, { 'group': $scope.newInterpreterSetting.group }), 'properties');

    var properties = {};
    for (var i=0; i < el.length; i++) {
      var intpInfo = el[i];
      for (var key in intpInfo) {
        properties[key] = {
          value: intpInfo[key].defaultValue,
          description: intpInfo[key].description
        };
      }
    }

    $scope.newInterpreterSetting.properties = properties;
  };

  $scope.restartInterpreterSetting = function(settingId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to restart this interpreter?',
      callback: function(result) {
        if (result) {
          $http.put(baseUrlSrv.getRestApiBase() + '/interpreter/setting/restart/' + settingId).
            success(function(data, status, headers, config) {
              var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });
              $scope.interpreterSettings[index] = data.body;
            }).
            error(function(data, status, headers, config) {
              console.log('Error %o %o', status, data.message);
            });
        }
      }
    });
  };

  $scope.addNewInterpreterSetting = function() {
    if (!$scope.newInterpreterSetting.name || !$scope.newInterpreterSetting.group) {
      BootstrapDialog.alert({
        closable: true,
        title: 'Add interpreter',
        message: 'Please determine name and interpreter'
      });
      return;
    }

    if (_.findIndex($scope.interpreterSettings, { 'name': $scope.newInterpreterSetting.name }) >= 0) {
      BootstrapDialog.alert({
        closable: true,
        title: 'Add interpreter',
        message: 'Name ' + $scope.newInterpreterSetting.name + ' already exists'
      });
      return;
    }

    var newSetting = $scope.newInterpreterSetting;
    if (newSetting.propertyKey !== '' || newSetting.propertyKey) {
      $scope.addNewInterpreterProperty();
    }
    if (newSetting.depArtifact !== '' || newSetting.depArtifact) {
      $scope.addNewInterpreterDependency();
    }

    var request = angular.copy($scope.newInterpreterSetting);

    // Change properties to proper request format
    var newProperties = {};
    for (var p in newSetting.properties) {
      newProperties[p] = newSetting.properties[p].value;
    }
    request.properties = newProperties;

    $http.post(baseUrlSrv.getRestApiBase() + '/interpreter/setting', request).
      success(function(data, status, headers, config) {
        $scope.resetNewInterpreterSetting();
        getInterpreterSettings();
        $scope.showAddNewSetting = false;
      }).
      error(function(data, status, headers, config) {
        console.log('Error %o %o', status, data.message);
        ngToast.danger({content: data.message, verticalPosition: 'bottom'});
      });
  };

  $scope.cancelInterpreterSetting = function() {
    $scope.showAddNewSetting = false;
    $scope.resetNewInterpreterSetting();
  };

  $scope.resetNewInterpreterSetting = function() {
    $scope.newInterpreterSetting = {
      name: undefined,
      group: undefined,
      properties: {},
      dependencies: [],
      option: {
        remote: true,
        perNoteSession: false,
        perNoteProcess: false
      }
    };
    emptyNewProperty($scope.newInterpreterSetting);
  };

  $scope.removeInterpreterProperty = function(key, settingId) {
    if (settingId === undefined) {
      delete $scope.newInterpreterSetting.properties[key];
    }
    else {
      var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });
      delete $scope.interpreterSettings[index].properties[key];
    }
  };

  $scope.removeInterpreterDependency = function(artifact, settingId) {
    if (settingId === undefined) {
      $scope.newInterpreterSetting.dependencies = _.reject($scope.newInterpreterSetting.dependencies,
        function(el) {
          return el.groupArtifactVersion === artifact;
        });
    } else {
      var index = _.findIndex($scope.interpreterSettings, {'id': settingId});
      $scope.interpreterSettings[index].dependencies = _.reject($scope.interpreterSettings[index].dependencies,
        function(el) {
          return el.groupArtifactVersion === artifact;
        });
    }
  };

  $scope.addNewInterpreterProperty = function(settingId) {
    if(settingId === undefined) {
      // Add new property from create form
      if (!$scope.newInterpreterSetting.propertyKey || $scope.newInterpreterSetting.propertyKey === '') {
        return;
      }

      $scope.newInterpreterSetting.properties[$scope.newInterpreterSetting.propertyKey] = {
        value: $scope.newInterpreterSetting.propertyValue
      };
      emptyNewProperty($scope.newInterpreterSetting);
    }
    else {
      // Add new property from edit form
      var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });
      var setting = $scope.interpreterSettings[index];

      if (!setting.propertyKey || setting.propertyKey === '') {
        return;
      }
      setting.properties[setting.propertyKey] = setting.propertyValue;
      emptyNewProperty(setting);
    }
  };

  $scope.addNewInterpreterDependency = function(settingId) {
    if(settingId === undefined) {
      // Add new dependency from create form
      if (!$scope.newInterpreterSetting.depArtifact || $scope.newInterpreterSetting.depArtifact === '') {
        return;
      }

      // overwrite if artifact already exists
      var newSetting = $scope.newInterpreterSetting;
      for(var d in newSetting.dependencies) {
        if (newSetting.dependencies[d].groupArtifactVersion === newSetting.depArtifact) {
          newSetting.dependencies[d] = {
            'groupArtifactVersion': newSetting.depArtifact,
            'exclusions': newSetting.depExclude
          };
          newSetting.dependencies.splice(d, 1);
        }
      }

      newSetting.dependencies.push({
        'groupArtifactVersion': newSetting.depArtifact,
        'exclusions': (newSetting.depExclude === '')? []: newSetting.depExclude
      });
      emptyNewDependency(newSetting);
    }
    else {
      // Add new dependency from edit form
      var index = _.findIndex($scope.interpreterSettings, { 'id': settingId });
      var setting = $scope.interpreterSettings[index];
      if (!setting.depArtifact || setting.depArtifact === '') {
        return;
      }

      // overwrite if artifact already exists
      for(var dep in setting.dependencies) {
        if (setting.dependencies[dep].groupArtifactVersion === setting.depArtifact) {
          setting.dependencies[dep] = {
            'groupArtifactVersion': setting.depArtifact,
            'exclusions': setting.depExclude
          };
          setting.dependencies.splice(dep, 1);
        }
      }

      setting.dependencies.push({
        'groupArtifactVersion': setting.depArtifact,
        'exclusions': (setting.depExclude === '')? []: setting.depExclude
      });
      emptyNewDependency(setting);
    }
  };

  $scope.resetNewRepositorySetting = function() {
    $scope.newRepoSetting = {
      id: undefined,
      url: undefined,
      snapshot: false,
      username: undefined,
      password: undefined
    };
  };

  var getRepositories = function() {
    $http.get(baseUrlSrv.getRestApiBase() + '/interpreter/repository').
      success(function(data, status, headers, config) {
        $scope.repositories = data.body;
      }).
      error(function(data, status, headers, config) {
        console.log('Error %o %o', status, data.message);
      });
  };

  $scope.addNewRepository = function() {
    var request = angular.copy($scope.newRepoSetting);

    $http.post(baseUrlSrv.getRestApiBase() + '/interpreter/repository', request).
      success(function(data, status, headers, config) {
        getRepositories();
        $scope.resetNewRepositorySetting();
        angular.element('#repoModal').modal('hide');
      }).
      error(function(data, status, headers, config) {
        console.log('Error %o %o', headers, config);
      });
  };

  $scope.removeRepository = function(repoId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to delete this repository?',
      callback: function(result) {
        if (result) {
          $http.delete(baseUrlSrv.getRestApiBase()+'/interpreter/repository/' + repoId).
            success(function(data, status, headers, config) {
              var index = _.findIndex($scope.repositories, { 'id': repoId });
              $scope.repositories.splice(index, 1);
            }).
            error(function(data, status, headers, config) {
              console.log('Error %o %o', status, data.message);
            });
        }
      }
    });
  };

  $scope.isDefaultRepository = function(repoId) {
    if (repoId === 'central' || repoId === 'local') {
      return true;
    } else {
      return false;
    }
  };

  var init = function() {
    $scope.resetNewInterpreterSetting();
    $scope.resetNewRepositorySetting();
    getInterpreterSettings();
    getAvailableInterpreters();
    getRepositories();
  };

  init();
}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').controller('ConfigurationCtrl', ["$scope", "$route", "$routeParams", "$location", "$rootScope", "$http", "baseUrlSrv", function($scope, $route, $routeParams, $location,
                                                                          $rootScope, $http, baseUrlSrv) {
  $scope.configrations = [];
  $scope._ = _;

  var getConfigurations = function() {
    $http.get(baseUrlSrv.getRestApiBase()+'/configurations/all').
    success(function(data, status, headers, config) {
      $scope.configurations = data.body;
    }).
    error(function(data, status, headers, config) {
      console.log('Error %o %o', status, data.message);
    });
  };

  var init = function() {
    getConfigurations();
  };

  init();
}]);

/*jshint loopfunc: true, unused:false */
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp')
  .controller('ParagraphCtrl', ["$scope", "$rootScope", "$route", "$window", "$element", "$routeParams", "$location", "$timeout", "$compile", "websocketMsgSrv", "ngToast", function($scope,$rootScope, $route, $window, $element, $routeParams, $location,
                                         $timeout, $compile, websocketMsgSrv, ngToast) {
  var ANGULAR_FUNCTION_OBJECT_NAME_PREFIX = '_Z_ANGULAR_FUNC_';
  $scope.parentNote = null;
  $scope.paragraph = null;
  $scope.originalText = '';
  $scope.editor = null;

  var paragraphScope = $rootScope.$new(true, $rootScope);

  // to keep backward compatibility
  $scope.compiledScope = paragraphScope;

  paragraphScope.z = {
    // z.runParagraph('20150213-231621_168813393')
    runParagraph: function(paragraphId) {
      if (paragraphId) {
        var filtered = $scope.parentNote.paragraphs.filter(function(x) {
          return x.id === paragraphId;});
        if (filtered.length === 1) {
          var paragraph = filtered[0];
          websocketMsgSrv.runParagraph(paragraph.id, paragraph.title, paragraph.text,
              paragraph.config, paragraph.settings.params);
        } else {
          ngToast.danger({content: 'Cannot find a paragraph with id \'' + paragraphId + '\'',
            verticalPosition: 'top', dismissOnTimeout: false});
        }
      } else {
        ngToast.danger({
          content: 'Please provide a \'paragraphId\' when calling z.runParagraph(paragraphId)',
          verticalPosition: 'top', dismissOnTimeout: false});
      }
    },

    // Example: z.angularBind('my_var', 'Test Value', '20150213-231621_168813393')
    angularBind: function(varName, value, paragraphId) {
      // Only push to server if there paragraphId is defined
      if (paragraphId) {
        websocketMsgSrv.clientBindAngularObject($routeParams.noteId, varName, value, paragraphId);
      } else {
        ngToast.danger({
          content: 'Please provide a \'paragraphId\' when calling ' +
          'z.angularBind(varName, value, \'PUT_HERE_PARAGRAPH_ID\')',
          verticalPosition: 'top', dismissOnTimeout: false});
      }
    },

    // Example: z.angularUnBind('my_var', '20150213-231621_168813393')
    angularUnbind: function(varName, paragraphId) {
      // Only push to server if paragraphId is defined
      if (paragraphId) {
        websocketMsgSrv.clientUnbindAngularObject($routeParams.noteId, varName, paragraphId);
      } else {
        ngToast.danger({
          content: 'Please provide a \'paragraphId\' when calling ' +
          'z.angularUnbind(varName, \'PUT_HERE_PARAGRAPH_ID\')',
          verticalPosition: 'top', dismissOnTimeout: false});
      }
    }
  };

  var angularObjectRegistry = {};

  var editorModes = {
    'ace/mode/python': /^%(\w*\.)?pyspark\s*$/,
    'ace/mode/scala': /^%(\w*\.)?spark\s*$/,
    'ace/mode/sql': /^%(\w*\.)?\wql/,
    'ace/mode/markdown': /^%md/,
    'ace/mode/sh': /^%sh/
  };

  // Controller init
  $scope.init = function(newParagraph, note) {
    $scope.paragraph = newParagraph;
    $scope.parentNote = note;
    $scope.originalText = angular.copy(newParagraph.text);
    $scope.chart = {};
    $scope.colWidthOption = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ];
    $scope.showTitleEditor = false;
    $scope.paragraphFocused = false;
    if (newParagraph.focus) {
      $scope.paragraphFocused = true;
    }

    if (!$scope.paragraph.config) {
      $scope.paragraph.config = {};
    }

    initializeDefault();

    if ($scope.getResultType() === 'TABLE') {
      $scope.loadTableData($scope.paragraph.result);
      $scope.setGraphMode($scope.getGraphMode(), false, false);
    } else if ($scope.getResultType() === 'HTML') {
      $scope.renderHtml();
    } else if ($scope.getResultType() === 'ANGULAR') {
      $scope.renderAngular();
    } else if ($scope.getResultType() === 'TEXT') {
      $scope.renderText();
    }
  };

    $scope.renderHtml = function() {
      var retryRenderer = function() {
      if (angular.element('#p' + $scope.paragraph.id + '_html').length) {
        try {
          angular.element('#p' + $scope.paragraph.id + '_html').html($scope.paragraph.result.msg);

          angular.element('#p' + $scope.paragraph.id + '_html').find('pre code').each(function(i, e) {
            hljs.highlightBlock(e);
          });
        } catch (err) {
          console.log('HTML rendering error %o', err);
        }
      } else {
        $timeout(retryRenderer, 10);
      }
    };
    $timeout(retryRenderer);
  };

  $scope.renderAngular = function() {
    var retryRenderer = function() {
      if (angular.element('#p'+$scope.paragraph.id+'_angular').length) {
        try {
          angular.element('#p'+$scope.paragraph.id+'_angular').html($scope.paragraph.result.msg);

          $compile(angular.element('#p'+$scope.paragraph.id+'_angular').contents())(paragraphScope);
        } catch(err) {
          console.log('ANGULAR rendering error %o', err);
        }
      } else {
        $timeout(retryRenderer, 10);
      }
    };
    $timeout(retryRenderer);
  };

  $scope.renderText = function() {
    var retryRenderer = function() {

      var textEl = angular.element('#p' + $scope.paragraph.id + '_text');
      if (textEl.length) {
        // clear all lines before render
        $scope.clearTextOutput();

        if ($scope.paragraph.result && $scope.paragraph.result.msg) {
          $scope.appendTextOutput($scope.paragraph.result.msg);
        }

        angular.element('#p' + $scope.paragraph.id + '_text').bind('mousewheel', function(e) {
          $scope.keepScrollDown = false;
        });
        $scope.flushStreamingOutput = true;
      } else {
        $timeout(retryRenderer, 10);
      }
    };
    $timeout(retryRenderer);
  };

  $scope.clearTextOutput = function() {
    var textEl = angular.element('#p' + $scope.paragraph.id + '_text');
    if (textEl.length) {
      textEl.children().remove();
    }
  };

  $scope.appendTextOutput = function(msg) {
    var textEl = angular.element('#p' + $scope.paragraph.id + '_text');
    if (textEl.length) {
      var lines = msg.split('\n');
      for (var i=0; i < lines.length; i++) {
        textEl.append(angular.element('<div></div>').text(lines[i]));
      }
    }
    if ($scope.keepScrollDown) {
      var doc = angular.element('#p' + $scope.paragraph.id + '_text');
      doc[0].scrollTop = doc[0].scrollHeight;
    }
  };



  $scope.$on('angularObjectUpdate', function(event, data) {
    var noteId = $route.current.pathParams.noteId;
    if (!data.noteId || (data.noteId === noteId && (!data.paragraphId || data.paragraphId === $scope.paragraph.id))) {
      var scope = paragraphScope;
      var varName = data.angularObject.name;

      if (angular.equals(data.angularObject.object, scope[varName])) {
        // return when update has no change
        return;
      }

      if (!angularObjectRegistry[varName]) {
        angularObjectRegistry[varName] = {
          interpreterGroupId : data.interpreterGroupId,
          noteId : data.noteId,
          paragraphId : data.paragraphId
        };
      } else {
        angularObjectRegistry[varName].noteId = angularObjectRegistry[varName].noteId || data.noteId;
        angularObjectRegistry[varName].paragraphId = angularObjectRegistry[varName].paragraphId || data.paragraphId;
      }

      angularObjectRegistry[varName].skipEmit = true;

      if (!angularObjectRegistry[varName].clearWatcher) {
        angularObjectRegistry[varName].clearWatcher = scope.$watch(varName, function(newValue, oldValue) {
          console.log('angular object (paragraph) updated %o %o', varName, angularObjectRegistry[varName]);
          if (angularObjectRegistry[varName].skipEmit) {
            angularObjectRegistry[varName].skipEmit = false;
            return;
          }
          websocketMsgSrv.updateAngularObject(
            angularObjectRegistry[varName].noteId,
            angularObjectRegistry[varName].paragraphId,
            varName,
            newValue,
            angularObjectRegistry[varName].interpreterGroupId);
        });
      }
      console.log('angular object (paragraph) created %o', varName);
      scope[varName] = data.angularObject.object;

      // create proxy for AngularFunction
      if (varName.startsWith(ANGULAR_FUNCTION_OBJECT_NAME_PREFIX)) {
        var funcName = varName.substring((ANGULAR_FUNCTION_OBJECT_NAME_PREFIX).length);
        scope[funcName] = function() {
          scope[varName] = arguments;
          console.log('angular function (paragraph) invoked %o', arguments);
        };

        console.log('angular function (paragraph) created %o', scope[funcName]);
      }
    }
  });


  $scope.$on('angularObjectRemove', function(event, data) {
    var noteId = $route.current.pathParams.noteId;
    if (!data.noteId || (data.noteId === noteId && (!data.paragraphId || data.paragraphId === $scope.paragraph.id))) {
      var scope = paragraphScope;
      var varName = data.name;

      // clear watcher
      if (angularObjectRegistry[varName]) {
        angularObjectRegistry[varName].clearWatcher();
        angularObjectRegistry[varName] = undefined;
      }

      // remove scope variable
      scope[varName] = undefined;

      // remove proxy for AngularFunction
      if (varName.startsWith(ANGULAR_FUNCTION_OBJECT_NAME_PREFIX)) {
        var funcName = varName.substring((ANGULAR_FUNCTION_OBJECT_NAME_PREFIX).length);
        scope[funcName] = undefined;
      }
    }
  });

  var initializeDefault = function() {
    var config = $scope.paragraph.config;

    if (!config.colWidth) {
      config.colWidth = 12;
    }

    if (!config.graph) {
      config.graph = {};
    }

    if (!config.graph.mode) {
      config.graph.mode = 'table';
    }

    if (!config.graph.height) {
      config.graph.height = 300;
    }

    if (!config.graph.optionOpen) {
      config.graph.optionOpen = false;
    }

    if (!config.graph.keys) {
      config.graph.keys = [];
    }

    if (!config.graph.values) {
      config.graph.values = [];
    }

    if (!config.graph.groups) {
      config.graph.groups = [];
    }

    if (!config.graph.scatter) {
      config.graph.scatter = {};
    }

    if (config.enabled === undefined) {
      config.enabled = true;
    }
  };

  $scope.getIframeDimensions = function () {
    if ($scope.asIframe) {
      var paragraphid = '#' + $routeParams.paragraphId + '_container';
      var height = angular.element(paragraphid).height();
      return height;
    }
    return 0;
  };

  $scope.$watch($scope.getIframeDimensions, function (newValue, oldValue) {
    if ($scope.asIframe && newValue) {
      var message = {};
      message.height = newValue;
      message.url = $location.$$absUrl;
      $window.parent.postMessage(angular.toJson(message), '*');
    }
  });

  var isEmpty = function (object) {
    return !object;
  };

  // TODO: this may have impact on performance when there are many paragraphs in a note.
  $scope.$on('updateParagraph', function(event, data) {
    if (data.paragraph.id === $scope.paragraph.id &&
        (data.paragraph.dateCreated !== $scope.paragraph.dateCreated ||
         data.paragraph.dateFinished !== $scope.paragraph.dateFinished ||
         data.paragraph.dateStarted !== $scope.paragraph.dateStarted ||
         data.paragraph.dateUpdated !== $scope.paragraph.dateUpdated ||
         data.paragraph.status !== $scope.paragraph.status ||
         data.paragraph.jobName !== $scope.paragraph.jobName ||
         data.paragraph.title !== $scope.paragraph.title ||
         isEmpty(data.paragraph.result) !== isEmpty($scope.paragraph.result) ||
         data.paragraph.errorMessage !== $scope.paragraph.errorMessage ||
         !angular.equals(data.paragraph.settings, $scope.paragraph.settings) ||
         !angular.equals(data.paragraph.config, $scope.paragraph.config))
       ) {

      var oldType = $scope.getResultType();
      var newType = $scope.getResultType(data.paragraph);
      var oldGraphMode = $scope.getGraphMode();
      var newGraphMode = $scope.getGraphMode(data.paragraph);
      var resultRefreshed = (data.paragraph.dateFinished !== $scope.paragraph.dateFinished) || isEmpty(data.paragraph.result) !== isEmpty($scope.paragraph.result);

      var statusChanged = (data.paragraph.status !== $scope.paragraph.status);

      //console.log("updateParagraph oldData %o, newData %o. type %o -> %o, mode %o -> %o", $scope.paragraph, data, oldType, newType, oldGraphMode, newGraphMode);

      if ($scope.paragraph.text !== data.paragraph.text) {
        if ($scope.dirtyText) {         // check if editor has local update
          if ($scope.dirtyText === data.paragraph.text ) {  // when local update is the same from remote, clear local update
            $scope.paragraph.text = data.paragraph.text;
            $scope.dirtyText = undefined;
            $scope.originalText = angular.copy(data.paragraph.text);
          } else { // if there're local update, keep it.
            $scope.paragraph.text = $scope.dirtyText;
          }
        } else {
          $scope.paragraph.text = data.paragraph.text;
          $scope.originalText = angular.copy(data.paragraph.text);
        }
      }

      /** push the rest */
      $scope.paragraph.authenticationInfo = data.paragraph.authenticationInfo;
      $scope.paragraph.aborted = data.paragraph.aborted;
      $scope.paragraph.dateUpdated = data.paragraph.dateUpdated;
      $scope.paragraph.dateCreated = data.paragraph.dateCreated;
      $scope.paragraph.dateFinished = data.paragraph.dateFinished;
      $scope.paragraph.dateStarted = data.paragraph.dateStarted;
      $scope.paragraph.errorMessage = data.paragraph.errorMessage;
      $scope.paragraph.jobName = data.paragraph.jobName;
      $scope.paragraph.title = data.paragraph.title;
      $scope.paragraph.lineNumbers = data.paragraph.lineNumbers;
      $scope.paragraph.status = data.paragraph.status;
      $scope.paragraph.result = data.paragraph.result;
      $scope.paragraph.settings = data.paragraph.settings;

      if (!$scope.asIframe) {
        $scope.paragraph.config = data.paragraph.config;
        initializeDefault();
      } else {
        data.paragraph.config.editorHide = true;
        data.paragraph.config.tableHide = false;
        $scope.paragraph.config = data.paragraph.config;
      }

      if (newType === 'TABLE') {
        $scope.loadTableData($scope.paragraph.result);
        if (oldType !== 'TABLE' || resultRefreshed) {
          clearUnknownColsFromGraphOption();
          selectDefaultColsForGraphOption();
        }
        /** User changed the chart type? */
        if (oldGraphMode !== newGraphMode) {
          $scope.setGraphMode(newGraphMode, false, false);
        } else {
          $scope.setGraphMode(newGraphMode, false, true);
        }
      } else if (newType === 'HTML' && resultRefreshed) {
        $scope.renderHtml();
      } else if (newType === 'ANGULAR' && resultRefreshed) {
        $scope.renderAngular();
      } else if (newType === 'TEXT' && resultRefreshed) {
        $scope.renderText();
      }

      if (statusChanged || resultRefreshed) {
        // when last paragraph runs, zeppelin automatically appends new paragraph.
        // this broadcast will focus to the newly inserted paragraph
        var paragraphs = angular.element('div[id$="_paragraphColumn_main"');
        if (paragraphs.length >= 2 && paragraphs[paragraphs.length-2].id.startsWith($scope.paragraph.id)) {
          // rendering output can took some time. So delay scrolling event firing for sometime.
          setTimeout(function() {
            $rootScope.$broadcast('scrollToCursor');
          }, 500);
        }
      }

    }

  });

  $scope.$on('appendParagraphOutput', function(event, data) {
    if ($scope.paragraph.id === data.paragraphId) {
      if ($scope.flushStreamingOutput) {
        $scope.clearTextOutput();
        $scope.flushStreamingOutput = false;
      }
      $scope.appendTextOutput(data.data);
    }
  });

  $scope.$on('updateParagraphOutput', function(event, data) {
    if ($scope.paragraph.id === data.paragraphId) {
      $scope.clearTextOutput();
      $scope.appendTextOutput(data.data);
    }
  });

  $scope.isRunning = function() {
    if ($scope.paragraph.status === 'RUNNING' || $scope.paragraph.status === 'PENDING') {
      return true;
    } else {
      return false;
    }
  };

  $scope.cancelParagraph = function() {
    console.log('Cancel %o', $scope.paragraph.id);
    websocketMsgSrv.cancelParagraphRun($scope.paragraph.id);
  };

  $scope.runParagraph = function(data) {
    websocketMsgSrv.runParagraph($scope.paragraph.id, $scope.paragraph.title,
                                 data, $scope.paragraph.config, $scope.paragraph.settings.params);
    $scope.originalText = angular.copy(data);
    $scope.dirtyText = undefined;
  };

  $scope.saveParagraph = function(){
    if($scope.dirtyText === undefined || $scope.dirtyText === $scope.originalText){
      return;
    }
    commitParagraph($scope.paragraph.title, $scope.dirtyText, $scope.paragraph.config, $scope.paragraph.settings.params);
    $scope.originalText = angular.copy($scope.dirtyText);
    $scope.dirtyText = undefined;
  };

  $scope.toggleEnableDisable = function () {
    $scope.paragraph.config.enabled = $scope.paragraph.config.enabled ? false : true;
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.run = function() {
    var editorValue = $scope.editor.getValue();
    if (editorValue) {
      if (!($scope.paragraph.status === 'RUNNING' || $scope.paragraph.status === 'PENDING')) {
        $scope.runParagraph(editorValue);
      }
    }
  };

  $scope.moveUp = function() {
    $scope.$emit('moveParagraphUp', $scope.paragraph.id);
  };

  $scope.moveDown = function() {
    $scope.$emit('moveParagraphDown', $scope.paragraph.id);
  };

  $scope.insertNew = function(position) {
    $scope.$emit('insertParagraph', $scope.paragraph.id, position || 'below');
  };

  $scope.removeParagraph = function() {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to delete this paragraph?',
      callback: function(result) {
        if (result) {
          console.log('Remove paragraph');
          websocketMsgSrv.removeParagraph($scope.paragraph.id);
        }
      }
    });
  };

  $scope.clearParagraphOutput = function() {
    websocketMsgSrv.clearParagraphOutput($scope.paragraph.id);
  };

  $scope.toggleEditor = function() {
    if ($scope.paragraph.config.editorHide) {
      $scope.openEditor();
    } else {
      $scope.closeEditor();
    }
  };

  $scope.closeEditor = function() {
    console.log('close the note');

    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.editorHide = true;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.openEditor = function() {
    console.log('open the note');

    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.editorHide = false;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.closeTable = function() {
    console.log('close the output');

    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.tableHide = true;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.openTable = function() {
    console.log('open the output');

    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.tableHide = false;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.showTitle = function() {
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.title = true;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.hideTitle = function() {
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.title = false;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.setTitle = function() {
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.showLineNumbers = function () {
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.lineNumbers = true;
    $scope.editor.renderer.setShowGutter(true);

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.hideLineNumbers = function () {
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.lineNumbers = false;
    $scope.editor.renderer.setShowGutter(false);

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.columnWidthClass = function(n) {
    if ($scope.asIframe) {
      return 'col-md-12';
    } else {
      return 'col-md-' + n;
    }
  };

  $scope.changeColWidth = function() {
    angular.element('.navbar-right.open').removeClass('open');
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.toggleGraphOption = function() {
    var newConfig = angular.copy($scope.paragraph.config);
    if (newConfig.graph.optionOpen) {
      newConfig.graph.optionOpen = false;
    } else {
      newConfig.graph.optionOpen = true;
    }
    var newParams = angular.copy($scope.paragraph.settings.params);

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.toggleOutput = function() {
    var newConfig = angular.copy($scope.paragraph.config);
    newConfig.tableHide = !newConfig.tableHide;
    var newParams = angular.copy($scope.paragraph.settings.params);

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  $scope.toggleLineWithFocus = function () {
    var mode = $scope.getGraphMode();

    if (mode === 'lineWithFocusChart') {
      $scope.setGraphMode('lineChart', true);
      return true;
    }

    if (mode === 'lineChart') {
      $scope.setGraphMode('lineWithFocusChart', true);
      return true;
    }

    return false;
  };



  $scope.loadForm = function(formulaire, params) {
    var value = formulaire.defaultValue;
    if (params[formulaire.name]) {
      value = params[formulaire.name];
    }

    $scope.paragraph.settings.params[formulaire.name] = value;
  };

  $scope.toggleCheckbox = function(formulaire, option) {
    var idx = $scope.paragraph.settings.params[formulaire.name].indexOf(option.value);
    if (idx > -1) {
      $scope.paragraph.settings.params[formulaire.name].splice(idx, 1);
    } else {
      $scope.paragraph.settings.params[formulaire.name].push(option.value);
    }
  };

  $scope.aceChanged = function() {
    $scope.dirtyText = $scope.editor.getSession().getValue();
    $scope.startSaveTimer();

    $timeout(function() {
      $scope.setParagraphMode($scope.editor.getSession(), $scope.dirtyText, $scope.editor.getCursorPosition());
    });
  };

  $scope.aceLoaded = function(_editor) {
    var langTools = ace.require('ace/ext/language_tools');
    var Range = ace.require('ace/range').Range;

    _editor.$blockScrolling = Infinity;
    $scope.editor = _editor;
    if (_editor.container.id !== '{{paragraph.id}}_editor') {
      $scope.editor.renderer.setShowGutter($scope.paragraph.config.lineNumbers);
      $scope.editor.setShowFoldWidgets(false);
      $scope.editor.setHighlightActiveLine(false);
      $scope.editor.setHighlightGutterLine(false);
      $scope.editor.getSession().setUseWrapMode(true);
      $scope.editor.setTheme('ace/theme/chrome');
      if ($scope.paragraphFocused) {
        $scope.editor.focus();
      }

      autoAdjustEditorHeight(_editor.container.id);
      angular.element(window).resize(function() {
        autoAdjustEditorHeight(_editor.container.id);
      });

      if (navigator.appVersion.indexOf('Mac') !== -1 ) {
        $scope.editor.setKeyboardHandler('ace/keyboard/emacs');
        $rootScope.isMac = true;
      } else if (navigator.appVersion.indexOf('Win') !== -1 ||
                 navigator.appVersion.indexOf('X11') !== -1 ||
                 navigator.appVersion.indexOf('Linux') !== -1) {
        $rootScope.isMac = false;
        // not applying emacs key binding while the binding override Ctrl-v. default behavior of paste text on windows.
      }

      $scope.setParagraphMode = function(session, paragraphText, pos) {
        // Evaluate the mode only if the first 30 characters of the paragraph have been modified or the the position is undefined.
        if ( (typeof pos === 'undefined') || (pos.row === 0 && pos.column < 30)) {
          // If paragraph loading, use config value if exists
          if ((typeof pos === 'undefined') && $scope.paragraph.config.editorMode) {
            session.setMode($scope.paragraph.config.editorMode);
          } else {
            // Defaults to spark mode
            var newMode = 'ace/mode/scala';
            // Test first against current mode
            var oldMode = session.getMode().$id;
            if (!editorModes[oldMode] || !editorModes[oldMode].test(paragraphText)) {
              for (var key in editorModes) {
                if (key !== oldMode) {
                  if (editorModes[key].test(paragraphText)){
                    $scope.paragraph.config.editorMode = key;
                    session.setMode(key);
                    return true;
                  }
                }
              }
              $scope.paragraph.config.editorMode = newMode;
              session.setMode(newMode);
            }
          }
        }
      };

      var remoteCompleter = {
        getCompletions : function(editor, session, pos, prefix, callback) {
          if (!$scope.editor.isFocused() ){ return;}

          pos = session.getTextRange(new Range(0, 0, pos.row, pos.column)).length;
          var buf = session.getValue();

          websocketMsgSrv.completion($scope.paragraph.id, buf, pos);

          $scope.$on('completionList', function(event, data) {
            if (data.completions) {
              var completions = [];
              for (var c in data.completions) {
                var v = data.completions[c];
                completions.push({
                  name:v,
                  value:v,
                  score:300
                });
              }
              callback(null, completions);
            }
          });
        }
      };

      langTools.setCompleters([remoteCompleter, langTools.keyWordCompleter, langTools.snippetCompleter, langTools.textCompleter]);

      $scope.editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: false,
        enableLiveAutocompletion:false
      });

      $scope.handleFocus = function(value) {
        $scope.paragraphFocused = value;
        // Protect against error in case digest is already running
        $timeout(function() {
          // Apply changes since they come from 3rd party library
          $scope.$digest();
        });
      };

      $scope.editor.on('focus', function() {
        $scope.handleFocus(true);
      });

      $scope.editor.on('blur', function() {
        $scope.handleFocus(false);
      });

      $scope.editor.getSession().on('change', function(e, editSession) {
        autoAdjustEditorHeight(_editor.container.id);
      });

      $scope.setParagraphMode($scope.editor.getSession(), $scope.editor.getSession().getValue());


      // autocomplete on '.'
      /*
      $scope.editor.commands.on("afterExec", function(e, t) {
        if (e.command.name == "insertstring" && e.args == "." ) {
      var all = e.editor.completers;
      //e.editor.completers = [remoteCompleter];
      e.editor.execCommand("startAutocomplete");
      //e.editor.completers = all;
    }
      });
      */

      // remove binding
      $scope.editor.commands.bindKey('ctrl-alt-n.', null);


      // autocomplete on 'ctrl+.'
      $scope.editor.commands.bindKey('ctrl-.', 'startAutocomplete');
      $scope.editor.commands.bindKey('ctrl-space', null);

      // handle cursor moves
      $scope.editor.keyBinding.origOnCommandKey = $scope.editor.keyBinding.onCommandKey;
      $scope.editor.keyBinding.onCommandKey = function(e, hashId, keyCode) {
        if ($scope.editor.completer && $scope.editor.completer.activated) { // if autocompleter is active
        } else {
          // fix ace editor focus issue in chrome (textarea element goes to top: -1000px after focused by cursor move)
          if (parseInt(angular.element('#' + $scope.paragraph.id + '_editor > textarea').css('top').replace('px', '')) < 0) {
            var position = $scope.editor.getCursorPosition();
            var cursorPos = $scope.editor.renderer.$cursorLayer.getPixelPosition(position, true);
            angular.element('#' + $scope.paragraph.id + '_editor > textarea').css('top', cursorPos.top);
          }

          var numRows;
          var currentRow;

          if (keyCode === 38 || (keyCode === 80 && e.ctrlKey && !e.altKey)) {  // UP
            numRows = $scope.editor.getSession().getLength();
            currentRow = $scope.editor.getCursorPosition().row;
            if (currentRow === 0) {
              // move focus to previous paragraph
              $scope.$emit('moveFocusToPreviousParagraph', $scope.paragraph.id);
            } else {
              $scope.scrollToCursor($scope.paragraph.id, -1);
            }
          } else if (keyCode === 40 || (keyCode === 78 && e.ctrlKey && !e.altKey)) {  // DOWN
            numRows = $scope.editor.getSession().getLength();
            currentRow = $scope.editor.getCursorPosition().row;
            if (currentRow === numRows-1) {
              // move focus to next paragraph
              $scope.$emit('moveFocusToNextParagraph', $scope.paragraph.id);
            } else {
              $scope.scrollToCursor($scope.paragraph.id, 1);
            }
          }
        }
        this.origOnCommandKey(e, hashId, keyCode);
      };
    }
  };

  var autoAdjustEditorHeight = function(id) {
    var editor = $scope.editor;
    var height = editor.getSession().getScreenLength() * editor.renderer.lineHeight + editor.renderer.scrollBar.getWidth();

    angular.element('#' + id).height(height.toString() + 'px');
    editor.resize();
  };

  $rootScope.$on('scrollToCursor', function(event) {
    // scroll on 'scrollToCursor' event only when cursor is in the last paragraph
    var paragraphs = angular.element('div[id$="_paragraphColumn_main"');
    if (paragraphs[paragraphs.length-1].id.startsWith($scope.paragraph.id)) {
      $scope.scrollToCursor($scope.paragraph.id, 0);
    }
  });

  /** scrollToCursor if it is necessary
   * when cursor touches scrollTriggerEdgeMargin from the top (or bottom) of the screen, it autoscroll to place cursor around 1/3 of screen height from the top (or bottom)
   * paragraphId : paragraph that has active cursor
   * lastCursorMove : 1(down), 0, -1(up) last cursor move event
   **/
  $scope.scrollToCursor = function(paragraphId, lastCursorMove) {
    if (!$scope.editor.isFocused()) {
     // only make sense when editor is focused
     return;
    }
    var lineHeight = $scope.editor.renderer.lineHeight;
    var headerHeight = 103; // menubar, notebook titlebar
    var scrollTriggerEdgeMargin = 50;

    var documentHeight = angular.element(document).height();
    var windowHeight = angular.element(window).height();  // actual viewport height

    var scrollPosition = angular.element(document).scrollTop();
    var editorPosition = angular.element('#'+paragraphId+'_editor').offset();
    var position = $scope.editor.getCursorPosition();
    var lastCursorPosition = $scope.editor.renderer.$cursorLayer.getPixelPosition(position, true);

    var calculatedCursorPosition = editorPosition.top + lastCursorPosition.top + lineHeight*lastCursorMove;

    var scrollTargetPos;
    if (calculatedCursorPosition < scrollPosition + headerHeight + scrollTriggerEdgeMargin) {
      scrollTargetPos = calculatedCursorPosition - headerHeight - ((windowHeight-headerHeight)/3);
      if (scrollTargetPos < 0) {
        scrollTargetPos = 0;
      }
    } else if(calculatedCursorPosition > scrollPosition + scrollTriggerEdgeMargin + windowHeight - headerHeight) {
      scrollTargetPos = calculatedCursorPosition - headerHeight - ((windowHeight-headerHeight)*2/3);

      if (scrollTargetPos > documentHeight) {
        scrollTargetPos = documentHeight;
      }
    }

    // cancel previous scroll animation
    var bodyEl = angular.element('body');
    bodyEl.stop();
    bodyEl.finish();

    // scroll to scrollTargetPos
    bodyEl.scrollTo(scrollTargetPos, {axis: 'y', interrupt: true, duration:100});
  };

  var setEditorHeight = function(id, height) {
    angular.element('#' + id).height(height.toString() + 'px');
  };

  $scope.getEditorValue = function() {
    return $scope.editor.getValue();
  };

  $scope.getProgress = function() {
    return ($scope.currentProgress) ? $scope.currentProgress : 0;
  };

  $scope.getExecutionTime = function() {
    var pdata = $scope.paragraph;
    var timeMs = Date.parse(pdata.dateFinished) - Date.parse(pdata.dateStarted);
    if (isNaN(timeMs) || timeMs < 0) {
      if ($scope.isResultOutdated()){
        return 'outdated';
      }
      return '';
    }
    var user = 'anonymous';
    if (pdata.authenticationInfo !== null && pdata.authenticationInfo.user !== null) {
      user = pdata.authenticationInfo.user;
    }
    var dateUpdated = (pdata.dateUpdated === null) ? 'unknown' : pdata.dateUpdated;
    var desc = 'Took ' + (timeMs/1000) + ' seconds. Last updated by ' + user + ' at time ' + dateUpdated + '.';
    if ($scope.isResultOutdated()){
      desc += ' (outdated)';
    }
    return desc;
  };

  $scope.isResultOutdated = function() {
    var pdata = $scope.paragraph;
    if (pdata.dateUpdated !==undefined && Date.parse(pdata.dateUpdated) > Date.parse(pdata.dateStarted)){
      return true;
    }
    return false;
  };

  $scope.$on('updateProgress', function(event, data) {
    if (data.id === $scope.paragraph.id) {
      $scope.currentProgress = data.progress;
    }
  });

  $scope.$on('keyEvent', function(event, keyEvent) {
    if ($scope.paragraphFocused) {

      var paragraphId = $scope.paragraph.id;
      var keyCode = keyEvent.keyCode;
      var noShortcutDefined = false;
      var editorHide = $scope.paragraph.config.editorHide;

      if (editorHide && (keyCode === 38 || (keyCode === 80 && keyEvent.ctrlKey && !keyEvent.altKey))) { // up
        // move focus to previous paragraph
        $scope.$emit('moveFocusToPreviousParagraph', paragraphId);
      } else if (editorHide && (keyCode === 40 || (keyCode === 78 && keyEvent.ctrlKey && !keyEvent.altKey))) { // down
        // move focus to next paragraph
        $scope.$emit('moveFocusToNextParagraph', paragraphId);
      } else if (keyEvent.shiftKey && keyCode === 13) { // Shift + Enter
        $scope.run();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 67) { // Ctrl + Alt + c
        $scope.cancelParagraph();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 68) { // Ctrl + Alt + d
        $scope.removeParagraph();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 75) { // Ctrl + Alt + k
        $scope.moveUp();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 74) { // Ctrl + Alt + j
        $scope.moveDown();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 65) { // Ctrl + Alt + a
        $scope.insertNew('above');
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 66) { // Ctrl + Alt + b
        $scope.insertNew('below');
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 79) { // Ctrl + Alt + o
        $scope.toggleOutput();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 82) { // Ctrl + Alt + r
        $scope.toggleEnableDisable();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 69) { // Ctrl + Alt + e
        $scope.toggleEditor();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 77) { // Ctrl + Alt + m
        if ($scope.paragraph.config.lineNumbers) {
          $scope.hideLineNumbers();
        } else {
          $scope.showLineNumbers();
        }
      } else if (keyEvent.ctrlKey && keyEvent.shiftKey && keyCode === 189) { // Ctrl + Shift + -
        $scope.paragraph.config.colWidth = Math.max(1, $scope.paragraph.config.colWidth - 1);
        $scope.changeColWidth();
      } else if (keyEvent.ctrlKey && keyEvent.shiftKey && keyCode === 187) { // Ctrl + Shift + =
        $scope.paragraph.config.colWidth = Math.min(12, $scope.paragraph.config.colWidth + 1);
        $scope.changeColWidth();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && ((keyCode >= 48 && keyCode <=57) || keyCode === 189 || keyCode === 187)) { // Ctrl + Alt + [1~9,0,-,=]
        var colWidth = 12;
        if (keyCode === 48) {
          colWidth = 10;
        } else if (keyCode === 189) {
          colWidth = 11;
        } else if (keyCode === 187) {
          colWidth = 12;
        } else {
          colWidth = keyCode - 48;
        }
        $scope.paragraph.config.colWidth = colWidth;
        $scope.changeColWidth();
      } else if (keyEvent.ctrlKey && keyEvent.altKey && keyCode === 84) { // Ctrl + Alt + t
        if ($scope.paragraph.config.title) {
          $scope.hideTitle();
        } else {
          $scope.showTitle();
        }
      } else {
        noShortcutDefined = true;
      }

      if (!noShortcutDefined) {
        keyEvent.preventDefault();
      }
    }
  });

  $scope.$on('focusParagraph', function(event, paragraphId, cursorPos, mouseEvent) {
    if ($scope.paragraph.id === paragraphId) {
      // focus editor
      if (!$scope.paragraph.config.editorHide) {
        if (!mouseEvent) {
          $scope.editor.focus();
          // move cursor to the first row (or the last row)
          var row;
          if (cursorPos >= 0) {
            row = cursorPos;
            $scope.editor.gotoLine(row, 0);
          } else {
            row = $scope.editor.session.getLength();
            $scope.editor.gotoLine(row, 0);
          }
          $scope.scrollToCursor($scope.paragraph.id, 0);
        }
      }
      $scope.handleFocus(true);
    } else {
      $scope.editor.blur();
      $scope.handleFocus(false);
    }
  });

  $scope.$on('runParagraph', function(event) {
    $scope.runParagraph($scope.editor.getValue());
  });

  $scope.$on('openEditor', function(event) {
    $scope.openEditor();
  });

  $scope.$on('closeEditor', function(event) {
    $scope.closeEditor();
  });

  $scope.$on('openTable', function(event) {
    $scope.openTable();
  });

  $scope.$on('closeTable', function(event) {
    $scope.closeTable();
  });


  $scope.getResultType = function(paragraph) {
    var pdata = (paragraph) ? paragraph : $scope.paragraph;
    if (pdata.result && pdata.result.type) {
      return pdata.result.type;
    } else {
      return 'TEXT';
    }
  };

  $scope.getBase64ImageSrc = function(base64Data) {
    return 'data:image/png;base64,'+base64Data;
  };

  $scope.getGraphMode = function(paragraph) {
    var pdata = (paragraph) ? paragraph : $scope.paragraph;
    if (pdata.config.graph && pdata.config.graph.mode) {
      return pdata.config.graph.mode;
    } else {
      return 'table';
    }
  };

  $scope.loadTableData = function(result) {
    if (!result) {
      return;
    }
    if (result.type === 'TABLE') {
      var columnNames = [];
      var rows = [];
      var array = [];
      var textRows = result.msg.split('\n');
      result.comment = '';
      var comment = false;

      for (var i = 0; i < textRows.length; i++) {
        var textRow = textRows[i];
        if (comment) {
          result.comment += textRow;
          continue;
        }

        if (textRow === '') {
          if (rows.length>0) {
            comment = true;
          }
          continue;
        }
        var textCols = textRow.split('\t');
        var cols = [];
        var cols2 = [];
        for (var j = 0; j < textCols.length; j++) {
          var col = textCols[j];
          if (i === 0) {
            columnNames.push({name:col, index:j, aggr:'sum'});
          } else {
            cols.push(col);
            cols2.push({key: (columnNames[i]) ? columnNames[i].name: undefined, value: col});
          }
        }
        if (i !== 0) {
          rows.push(cols);
          array.push(cols2);
        }
      }
      result.msgTable = array;
      result.columnNames = columnNames;
      result.rows = rows;
    }
  };

  $scope.setGraphMode = function(type, emit, refresh) {
    if (emit) {
      setNewMode(type);
    } else {
      clearUnknownColsFromGraphOption();
      // set graph height
      var height = $scope.paragraph.config.graph.height;
      angular.element('#p' + $scope.paragraph.id + '_graph').height(height);

      if (!type || type === 'table') {
        setTable($scope.paragraph.result, refresh);
      }
      else {
        setD3Chart(type, $scope.paragraph.result, refresh);
      }
    }
  };

  var setNewMode = function(newMode) {
    var newConfig = angular.copy($scope.paragraph.config);
    var newParams = angular.copy($scope.paragraph.settings.params);

    // graph options
    newConfig.graph.mode = newMode;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  var commitParagraph = function(title, text, config, params) {
    websocketMsgSrv.commitParagraph($scope.paragraph.id, title, text, config, params);
  };

  var setTable = function(type, data, refresh) {
    var getTableContentFormat = function(d) {
      if (isNaN(d)) {
        if (d.length>'%html'.length && '%html ' === d.substring(0, '%html '.length)) {
          return 'html';
        } else {
          return '';
        }
      } else {
        return '';
      }
    };

    var formatTableContent = function(d) {
      if (isNaN(d)) {
        var f = getTableContentFormat(d);
        if (f !== '') {
          return d.substring(f.length+2);
        } else {
          return d;
        }
      } else {
        var dStr = d.toString();
        var splitted = dStr.split('.');
        var formatted = splitted[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
        if (splitted.length>1) {
          formatted+= '.'+splitted[1];
        }
        return formatted;
      }
    };


    var renderTable = function() {
      var html = '';
      html += '<table class="table table-hover table-condensed">';
      html += '  <thead>';
      html += '    <tr style="background-color: #F6F6F6; font-weight: bold;">';
      for (var titleIndex in $scope.paragraph.result.columnNames) {
        html += '<th>'+$scope.paragraph.result.columnNames[titleIndex].name+'</th>';
      }
      html += '    </tr>';
      html += '  </thead>';
      html += '  <tbody>';
      for (var r in $scope.paragraph.result.msgTable) {
        var row = $scope.paragraph.result.msgTable[r];
        html += '    <tr>';
        for (var index in row) {
          var v = row[index].value;
          if (getTableContentFormat(v) !== 'html') {
            v = v.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
              return '&#'+i.charCodeAt(0)+';';
            });
          }
        html += '      <td>'+formatTableContent(v)+'</td>';
        }
        html += '    </tr>';
      }
      html += '  </tbody>';
      html += '</table>';

      var tableDomEl = angular.element('#p' + $scope.paragraph.id + '_table');
      tableDomEl.html(html);
      var oTable = tableDomEl.children(1).DataTable({
        paging:       false,
        info:         false,
        autoWidth:    false,
        lengthChange: false,
        searching: false,
        dom: '<>'
      });

      if ($scope.paragraph.result.msgTable.length > 10000) {
        tableDomEl.css({
          'overflow': 'scroll',
          'height': $scope.paragraph.config.graph.height
        });
      } else {

        var dataTable = angular.element('#p' + $scope.paragraph.id + '_table .table');
        dataTable.floatThead({
          scrollContainer: function(dataTable) {
            return tableDomEl;
          }
        });

        dataTable.on('remove', function () {
          dataTable.floatThead('destroy');
        });

        tableDomEl.css({
          'position': 'relative',
          'height': '100%'
        });
        tableDomEl.perfectScrollbar('destroy')
                  .perfectScrollbar({minScrollbarLength: 20});

        angular.element('.ps-scrollbar-y-rail').css('z-index', '1002');

        // set table height
        var psHeight = $scope.paragraph.config.graph.height;
        tableDomEl.css('height', psHeight);
        tableDomEl.perfectScrollbar('update');
      }

    };

    var retryRenderer = function() {
      if (angular.element('#p' + $scope.paragraph.id + '_table').length) {
        try {
          renderTable();
        } catch(err) {
          console.log('Chart drawing error %o', err);
        }
      } else {
        $timeout(retryRenderer,10);
      }
    };
    $timeout(retryRenderer);

  };

  var groupedThousandsWith3DigitsFormatter = function(x){
    return d3.format(',')(d3.round(x, 3));
  };

  var customAbbrevFormatter = function(x) {
    var s = d3.format('.3s')(x);
    switch (s[s.length - 1]) {
      case 'G': return s.slice(0, -1) + 'B';
    }
    return s;
  };

  var xAxisTickFormat = function(d, xLabels) {
    if (xLabels[d] && (isNaN(parseFloat(xLabels[d])) || !isFinite(xLabels[d]))) { // to handle string type xlabel
      return xLabels[d];
    } else {
      return d;
    }
  };

  var yAxisTickFormat = function(d) {
    if(d >= Math.pow(10,6)){
      return customAbbrevFormatter(d);
    }
    return groupedThousandsWith3DigitsFormatter(d);
  };

  var setD3Chart = function(type, data, refresh) {
    if (!$scope.chart[type]) {
      var chart = nv.models[type]();
      $scope.chart[type] = chart;
    }

    var d3g = [];
    var xLabels;
    var yLabels;

    if (type === 'scatterChart') {
      var scatterData = setScatterChart(data, refresh);

      xLabels = scatterData.xLabels;
      yLabels = scatterData.yLabels;
      d3g = scatterData.d3g;

      $scope.chart[type].xAxis.tickFormat(function(d) {return xAxisTickFormat(d, xLabels);});
      $scope.chart[type].yAxis.tickFormat(function(d) {return xAxisTickFormat(d, yLabels);});

      // configure how the tooltip looks.
      $scope.chart[type].tooltipContent(function(key, x, y, graph, data) {
        var tooltipContent = '<h3>' + key + '</h3>';
        if ($scope.paragraph.config.graph.scatter.size &&
            $scope.isValidSizeOption($scope.paragraph.config.graph.scatter, $scope.paragraph.result.rows)) {
          tooltipContent += '<p>' + data.point.size + '</p>';
        }

        return tooltipContent;
      });

      $scope.chart[type].showDistX(true)
        .showDistY(true);
      //handle the problem of tooltip not showing when muliple points have same value.
    } else {
      var p = pivot(data);
      if (type === 'pieChart') {
        var d = pivotDataToD3ChartFormat(p, true).d3g;

        $scope.chart[type].x(function(d) { return d.label;})
          .y(function(d) { return d.value;});

        if ( d.length > 0 ) {
          for ( var i=0; i<d[0].values.length ; i++) {
            var e = d[0].values[i];
            d3g.push({
              label : e.x,
              value : e.y
            });
          }
        }
      } else if (type === 'multiBarChart') {
        d3g = pivotDataToD3ChartFormat(p, true, false, type).d3g;
        $scope.chart[type].yAxis.axisLabelDistance(50);
        $scope.chart[type].yAxis.tickFormat(function(d) {return yAxisTickFormat(d);});
      } else if (type === 'lineChart' || type === 'stackedAreaChart' || type === 'lineWithFocusChart') {
        var pivotdata = pivotDataToD3ChartFormat(p, false, true);
        xLabels = pivotdata.xLabels;
        d3g = pivotdata.d3g;
        $scope.chart[type].xAxis.tickFormat(function(d) {return xAxisTickFormat(d, xLabels);});
        $scope.chart[type].yAxis.tickFormat(function(d) {return yAxisTickFormat(d);});
        $scope.chart[type].yAxis.axisLabelDistance(50);
        if ($scope.chart[type].useInteractiveGuideline) { // lineWithFocusChart hasn't got useInteractiveGuideline
          $scope.chart[type].useInteractiveGuideline(true); // for better UX and performance issue. (https://github.com/novus/nvd3/issues/691)
        }
        if($scope.paragraph.config.graph.forceY) {
          $scope.chart[type].forceY([0]); // force y-axis minimum to 0 for line chart.
        } else {
          $scope.chart[type].forceY([]);
        }
      }
    }

    var renderChart = function() {
      if (!refresh) {
        // TODO force destroy previous chart
      }

      var height = $scope.paragraph.config.graph.height;

      var animationDuration = 300;
      var numberOfDataThreshold = 150;
      // turn off animation when dataset is too large. (for performance issue)
      // still, since dataset is large, the chart content sequentially appears like animated.
      try {
        if (d3g[0].values.length > numberOfDataThreshold) {
          animationDuration = 0;
        }
      } catch(ignoreErr) {
      }

      var chartEl = d3.select('#p'+$scope.paragraph.id+'_'+type+' svg')
      .attr('height', $scope.paragraph.config.graph.height)
      .datum(d3g)
      .transition()
      .duration(animationDuration)
      .call($scope.chart[type]);
      d3.select('#p'+$scope.paragraph.id+'_'+type+' svg').style.height = height+'px';
      nv.utils.windowResize($scope.chart[type].update);
    };

    var retryRenderer = function() {
      if (angular.element('#p' + $scope.paragraph.id + '_' + type + ' svg').length !== 0) {
        try {
          renderChart();
        } catch(err) {
          console.log('Chart drawing error %o', err);
        }
      } else {
        $timeout(retryRenderer,10);
      }
    };
    $timeout(retryRenderer);
  };

  $scope.isGraphMode = function(graphName) {
    if ($scope.getResultType() === 'TABLE' && $scope.getGraphMode()===graphName) {
      return true;
    } else {
      return false;
    }
  };


  $scope.onGraphOptionChange = function() {
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeGraphOptionKeys = function(idx) {
    $scope.paragraph.config.graph.keys.splice(idx, 1);
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeGraphOptionValues = function(idx) {
    $scope.paragraph.config.graph.values.splice(idx, 1);
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeGraphOptionGroups = function(idx) {
    $scope.paragraph.config.graph.groups.splice(idx, 1);
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.setGraphOptionValueAggr = function(idx, aggr) {
    $scope.paragraph.config.graph.values[idx].aggr = aggr;
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeScatterOptionXaxis = function(idx) {
    $scope.paragraph.config.graph.scatter.xAxis = null;
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeScatterOptionYaxis = function(idx) {
    $scope.paragraph.config.graph.scatter.yAxis = null;
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeScatterOptionGroup = function(idx) {
    $scope.paragraph.config.graph.scatter.group = null;
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  $scope.removeScatterOptionSize = function(idx) {
    $scope.paragraph.config.graph.scatter.size = null;
    clearUnknownColsFromGraphOption();
    $scope.setGraphMode($scope.paragraph.config.graph.mode, true, false);
  };

  /* Clear unknown columns from graph option */
  var clearUnknownColsFromGraphOption = function() {
    var unique = function(list) {
      for (var i = 0; i<list.length; i++) {
        for (var j=i+1; j<list.length; j++) {
          if (angular.equals(list[i], list[j])) {
            list.splice(j, 1);
          }
        }
      }
    };

    var removeUnknown = function(list) {
      for (var i = 0; i<list.length; i++) {
        // remove non existing column
        var found = false;
        for (var j=0; j<$scope.paragraph.result.columnNames.length; j++) {
          var a = list[i];
          var b = $scope.paragraph.result.columnNames[j];
          if (a.index === b.index && a.name === b.name) {
            found = true;
            break;
          }
        }
        if (!found) {
          list.splice(i, 1);
        }
      }
    };

    var removeUnknownFromScatterSetting = function(fields) {
      for (var f in fields) {
        if (fields[f]) {
          var found = false;
          for (var i = 0; i < $scope.paragraph.result.columnNames.length; i++) {
            var a = fields[f];
            var b = $scope.paragraph.result.columnNames[i];
            if (a.index === b.index && a.name === b.name) {
              found = true;
              break;
            }
          }
          if (!found) {
            fields[f] = null;
          }
        }
      }
    };

    unique($scope.paragraph.config.graph.keys);
    removeUnknown($scope.paragraph.config.graph.keys);

    removeUnknown($scope.paragraph.config.graph.values);

    unique($scope.paragraph.config.graph.groups);
    removeUnknown($scope.paragraph.config.graph.groups);

    removeUnknownFromScatterSetting($scope.paragraph.config.graph.scatter);
  };

  /* select default key and value if there're none selected */
  var selectDefaultColsForGraphOption = function() {
    if ($scope.paragraph.config.graph.keys.length === 0 && $scope.paragraph.result.columnNames.length > 0) {
      $scope.paragraph.config.graph.keys.push($scope.paragraph.result.columnNames[0]);
    }

    if ($scope.paragraph.config.graph.values.length === 0 && $scope.paragraph.result.columnNames.length > 1) {
      $scope.paragraph.config.graph.values.push($scope.paragraph.result.columnNames[1]);
    }

    if (!$scope.paragraph.config.graph.scatter.xAxis && !$scope.paragraph.config.graph.scatter.yAxis) {
      if ($scope.paragraph.result.columnNames.length > 1) {
        $scope.paragraph.config.graph.scatter.xAxis = $scope.paragraph.result.columnNames[0];
        $scope.paragraph.config.graph.scatter.yAxis = $scope.paragraph.result.columnNames[1];
      } else if ($scope.paragraph.result.columnNames.length === 1) {
        $scope.paragraph.config.graph.scatter.xAxis = $scope.paragraph.result.columnNames[0];
      }
    }
  };

  var pivot = function(data) {
    var keys = $scope.paragraph.config.graph.keys;
    var groups = $scope.paragraph.config.graph.groups;
    var values = $scope.paragraph.config.graph.values;

    var aggrFunc = {
      sum : function(a,b) {
        var varA = (a !== undefined) ? (isNaN(a) ? 1 : parseFloat(a)) : 0;
        var varB = (b !== undefined) ? (isNaN(b) ? 1 : parseFloat(b)) : 0;
        return varA+varB;
      },
      count : function(a,b) {
        var varA = (a !== undefined) ? parseInt(a) : 0;
        var varB = (b !== undefined) ? 1 : 0;
        return varA+varB;
      },
      min : function(a,b) {
        var varA = (a !== undefined) ? (isNaN(a) ? 1 : parseFloat(a)) : 0;
        var varB = (b !== undefined) ? (isNaN(b) ? 1 : parseFloat(b)) : 0;
        return Math.min(varA,varB);
      },
      max : function(a,b) {
        var varA = (a !== undefined) ? (isNaN(a) ? 1 : parseFloat(a)) : 0;
        var varB = (b !== undefined) ? (isNaN(b) ? 1 : parseFloat(b)) : 0;
        return Math.max(varA,varB);
      },
      avg : function(a,b,c) {
        var varA = (a !== undefined) ? (isNaN(a) ? 1 : parseFloat(a)) : 0;
        var varB = (b !== undefined) ? (isNaN(b) ? 1 : parseFloat(b)) : 0;
        return varA+varB;
      }
    };

    var aggrFuncDiv = {
      sum : false,
      count : false,
      min : false,
      max : false,
      avg : true
    };

    var schema = {};
    var rows = {};

    for (var i=0; i < data.rows.length; i++) {
      var row = data.rows[i];
      var newRow = {};
      var s = schema;
      var p = rows;

      for (var k=0; k < keys.length; k++) {
        var key = keys[k];

        // add key to schema
        if (!s[key.name]) {
          s[key.name] = {
            order : k,
            index : key.index,
            type : 'key',
            children : {}
          };
        }
        s = s[key.name].children;

        // add key to row
        var keyKey = row[key.index];
        if (!p[keyKey]) {
          p[keyKey] = {};
        }
        p = p[keyKey];
      }

      for (var g=0; g < groups.length; g++) {
        var group = groups[g];
        var groupKey = row[group.index];

        // add group to schema
        if (!s[groupKey]) {
          s[groupKey] = {
            order : g,
            index : group.index,
            type : 'group',
            children : {}
          };
        }
        s = s[groupKey].children;

        // add key to row
        if (!p[groupKey]) {
          p[groupKey] = {};
        }
        p = p[groupKey];
      }

      for (var v=0; v < values.length; v++) {
        var value = values[v];
        var valueKey = value.name+'('+value.aggr+')';

        // add value to schema
        if (!s[valueKey]) {
          s[valueKey] = {
            type : 'value',
            order : v,
            index : value.index
          };
        }

        // add value to row
        if (!p[valueKey]) {
          p[valueKey] = {
            value : (value.aggr !== 'count') ? row[value.index] : 1,
            count: 1
          };
        } else {
          p[valueKey] = {
            value : aggrFunc[value.aggr](p[valueKey].value, row[value.index], p[valueKey].count+1),
            count : (aggrFuncDiv[value.aggr]) ?  p[valueKey].count+1 : p[valueKey].count
          };
        }
      }
    }

    //console.log("schema=%o, rows=%o", schema, rows);

    return {
      schema : schema,
      rows : rows
    };
  };

  var pivotDataToD3ChartFormat = function(data, allowTextXAxis, fillMissingValues, chartType) {
    // construct d3 data
    var d3g = [];

    var schema = data.schema;
    var rows = data.rows;
    var values = $scope.paragraph.config.graph.values;

    var concat = function(o, n) {
      if (!o) {
        return n;
      } else {
        return o+'.'+n;
      }
    };

    var getSchemaUnderKey = function(key, s) {
      for (var c in key.children) {
        s[c] = {};
        getSchemaUnderKey(key.children[c], s[c]);
      }
    };

    var traverse = function(sKey, s, rKey, r, func, rowName, rowValue, colName) {
      //console.log("TRAVERSE sKey=%o, s=%o, rKey=%o, r=%o, rowName=%o, rowValue=%o, colName=%o", sKey, s, rKey, r, rowName, rowValue, colName);

      if (s.type==='key') {
        rowName = concat(rowName, sKey);
        rowValue = concat(rowValue, rKey);
      } else if (s.type==='group') {
        colName = concat(colName, rKey);
      } else if (s.type==='value' && sKey===rKey || valueOnly) {
        colName = concat(colName, rKey);
        func(rowName, rowValue, colName, r);
      }

      for (var c in s.children) {
        if (fillMissingValues && s.children[c].type === 'group' && r[c] === undefined) {
          var cs = {};
          getSchemaUnderKey(s.children[c], cs);
          traverse(c, s.children[c], c, cs, func, rowName, rowValue, colName);
          continue;
        }

        for (var j in r) {
          if (s.children[c].type === 'key' || c === j) {
            traverse(c, s.children[c], j, r[j], func, rowName, rowValue, colName);
          }
        }
      }
    };

    var keys = $scope.paragraph.config.graph.keys;
    var groups = $scope.paragraph.config.graph.groups;
    values = $scope.paragraph.config.graph.values;
    var valueOnly = (keys.length === 0 && groups.length === 0 && values.length > 0);
    var noKey = (keys.length === 0);
    var isMultiBarChart = (chartType === 'multiBarChart');

    var sKey = Object.keys(schema)[0];

    var rowNameIndex = {};
    var rowIdx = 0;
    var colNameIndex = {};
    var colIdx = 0;
    var rowIndexValue = {};

    for (var k in rows) {
      traverse(sKey, schema[sKey], k, rows[k], function(rowName, rowValue, colName, value) {
        //console.log("RowName=%o, row=%o, col=%o, value=%o", rowName, rowValue, colName, value);
        if (rowNameIndex[rowValue] === undefined) {
          rowIndexValue[rowIdx] = rowValue;
          rowNameIndex[rowValue] = rowIdx++;
        }

        if (colNameIndex[colName] === undefined) {
          colNameIndex[colName] = colIdx++;
        }
        var i = colNameIndex[colName];
        if (noKey && isMultiBarChart) {
          i = 0;
        }

        if (!d3g[i]) {
          d3g[i] = {
            values : [],
            key : (noKey && isMultiBarChart) ? 'values' : colName
          };
        }

        var xVar = isNaN(rowValue) ? ((allowTextXAxis) ? rowValue : rowNameIndex[rowValue]) : parseFloat(rowValue);
        var yVar = 0;
        if (xVar === undefined) { xVar = colName; }
        if (value !== undefined) {
          yVar = isNaN(value.value) ? 0 : parseFloat(value.value) / parseFloat(value.count);
        }
        d3g[i].values.push({
          x : xVar,
          y : yVar
        });
      });
    }

    // clear aggregation name, if possible
    var namesWithoutAggr = {};
    var colName;
    var withoutAggr;
    // TODO - This part could use som refactoring - Weird if/else with similar actions and variable names
    for (colName in colNameIndex) {
      withoutAggr = colName.substring(0, colName.lastIndexOf('('));
      if (!namesWithoutAggr[withoutAggr]) {
        namesWithoutAggr[withoutAggr] = 1;
      } else {
        namesWithoutAggr[withoutAggr]++;
      }
    }

    if (valueOnly) {
      for (var valueIndex = 0; valueIndex < d3g[0].values.length; valueIndex++) {
        colName = d3g[0].values[valueIndex].x;
        if (!colName) {
          continue;
        }

        withoutAggr = colName.substring(0, colName.lastIndexOf('('));
        if (namesWithoutAggr[withoutAggr] <= 1 ) {
          d3g[0].values[valueIndex].x = withoutAggr;
        }
      }
    } else {
      for (var d3gIndex = 0; d3gIndex < d3g.length; d3gIndex++) {
        colName = d3g[d3gIndex].key;
        withoutAggr = colName.substring(0, colName.lastIndexOf('('));
        if (namesWithoutAggr[withoutAggr] <= 1 ) {
          d3g[d3gIndex].key = withoutAggr;
        }
      }

      // use group name instead of group.value as a column name, if there're only one group and one value selected.
      if (groups.length === 1 && values.length === 1) {
        for (d3gIndex = 0; d3gIndex < d3g.length; d3gIndex++) {
          colName = d3g[d3gIndex].key;
          colName = colName.split('.')[0];
          d3g[d3gIndex].key = colName;
        }
      }

    }

    return {
      xLabels : rowIndexValue,
      d3g : d3g
    };
  };


  var setDiscreteScatterData = function(data) {
    var xAxis = $scope.paragraph.config.graph.scatter.xAxis;
    var yAxis = $scope.paragraph.config.graph.scatter.yAxis;
    var group = $scope.paragraph.config.graph.scatter.group;

    var xValue;
    var yValue;
    var grp;

    var rows = {};

    for (var i = 0; i < data.rows.length; i++) {
      var row = data.rows[i];
      if (xAxis) {
        xValue = row[xAxis.index];
      }
      if (yAxis) {
        yValue = row[yAxis.index];
      }
      if (group) {
        grp = row[group.index];
      }

      var key = xValue + ',' + yValue +  ',' + grp;

      if(!rows[key]) {
        rows[key] = {
          x : xValue,
          y : yValue,
          group : grp,
          size : 1
        };
      } else {
        rows[key].size++;
      }
    }

    // change object into array
    var newRows = [];
    for(var r in rows){
      var newRow = [];
      if (xAxis) { newRow[xAxis.index] = rows[r].x; }
      if (yAxis) { newRow[yAxis.index] = rows[r].y; }
      if (group) { newRow[group.index] = rows[r].group; }
      newRow[data.rows[0].length] = rows[r].size;
      newRows.push(newRow);
    }
    return newRows;
  };

  var setScatterChart = function(data, refresh) {
    var xAxis = $scope.paragraph.config.graph.scatter.xAxis;
    var yAxis = $scope.paragraph.config.graph.scatter.yAxis;
    var group = $scope.paragraph.config.graph.scatter.group;
    var size = $scope.paragraph.config.graph.scatter.size;

    var xValues = [];
    var yValues = [];
    var rows = {};
    var d3g = [];

    var rowNameIndex = {};
    var colNameIndex = {};
    var grpNameIndex = {};
    var rowIndexValue = {};
    var colIndexValue = {};
    var grpIndexValue = {};
    var rowIdx = 0;
    var colIdx = 0;
    var grpIdx = 0;
    var grpName = '';

    var xValue;
    var yValue;
    var row;

    if (!xAxis && !yAxis) {
      return {
        d3g : []
      };
    }

    for (var i = 0; i < data.rows.length; i++) {
      row = data.rows[i];
      if (xAxis) {
        xValue = row[xAxis.index];
        xValues[i] = xValue;
      }
      if (yAxis) {
        yValue = row[yAxis.index];
        yValues[i] = yValue;
      }
    }

    var isAllDiscrete = ((xAxis && yAxis && isDiscrete(xValues) && isDiscrete(yValues)) ||
                         (!xAxis && isDiscrete(yValues)) ||
                         (!yAxis && isDiscrete(xValues)));

    if (isAllDiscrete) {
      rows = setDiscreteScatterData(data);
    } else {
      rows = data.rows;
    }

    if (!group && isAllDiscrete) {
      grpName = 'count';
    } else if (!group && !size) {
      if (xAxis && yAxis) {
        grpName = '(' + xAxis.name + ', ' + yAxis.name + ')';
      } else if (xAxis && !yAxis) {
        grpName = xAxis.name;
      } else if (!xAxis && yAxis) {
        grpName = yAxis.name;
      }
    } else if (!group && size) {
      grpName = size.name;
    }

    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      if (xAxis) {
        xValue = row[xAxis.index];
      }
      if (yAxis) {
        yValue = row[yAxis.index];
      }
      if (group) {
        grpName = row[group.index];
      }
      var sz = (isAllDiscrete) ? row[row.length-1] : ((size) ? row[size.index] : 1);

      if (grpNameIndex[grpName] === undefined) {
        grpIndexValue[grpIdx] = grpName;
        grpNameIndex[grpName] = grpIdx++;
      }

      if (xAxis && rowNameIndex[xValue] === undefined) {
        rowIndexValue[rowIdx] = xValue;
        rowNameIndex[xValue] = rowIdx++;
      }

      if (yAxis && colNameIndex[yValue] === undefined) {
        colIndexValue[colIdx] = yValue;
        colNameIndex[yValue] = colIdx++;
      }

      if (!d3g[grpNameIndex[grpName]]) {
        d3g[grpNameIndex[grpName]] = {
          key : grpName,
          values : []
        };
      }

      d3g[grpNameIndex[grpName]].values.push({
        x : xAxis ? (isNaN(xValue) ? rowNameIndex[xValue] : parseFloat(xValue)) : 0,
        y : yAxis ? (isNaN(yValue) ? colNameIndex[yValue] : parseFloat(yValue)) : 0,
        size : isNaN(parseFloat(sz))? 1 : parseFloat(sz)
      });
    }

    return {
      xLabels : rowIndexValue,
      yLabels : colIndexValue,
      d3g : d3g
    };
  };

  var isDiscrete = function(field) {
    var getUnique = function(f) {
      var uniqObj = {};
      var uniqArr = [];
      var j = 0;
      for (var i = 0; i < f.length; i++) {
        var item = f[i];
        if(uniqObj[item] !== 1) {
          uniqObj[item] = 1;
          uniqArr[j++] = item;
        }
      }
      return uniqArr;
    };

    for (var i = 0; i < field.length; i++) {
      if(isNaN(parseFloat(field[i])) &&
         (typeof field[i] === 'string' || field[i] instanceof String)) {
        return true;
      }
    }

    var threshold = 0.05;
    var unique = getUnique(field);
    if (unique.length/field.length < threshold) {
      return true;
    } else {
      return false;
    }
  };

  $scope.isValidSizeOption = function (options, rows) {
    var xValues = [];
    var yValues = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var size = row[options.size.index];

      //check if the field is numeric
      if (isNaN(parseFloat(size)) || !isFinite(size)) {
        return false;
      }

      if (options.xAxis) {
        var x = row[options.xAxis.index];
        xValues[i] = x;
      }
      if (options.yAxis) {
        var y = row[options.yAxis.index];
        yValues[i] = y;
      }
    }

    //check if all existing fields are discrete
    var isAllDiscrete = ((options.xAxis && options.yAxis && isDiscrete(xValues) && isDiscrete(yValues)) ||
                         (!options.xAxis && isDiscrete(yValues)) ||
                         (!options.yAxis && isDiscrete(xValues)));

    if (isAllDiscrete) {
      return false;
    }

    return true;
  };

  $scope.resizeParagraph = function(width, height) {
    if ($scope.paragraph.config.colWidth !== width) {

        $scope.paragraph.config.colWidth = width;
        $scope.changeColWidth();
        $timeout(function() {
          autoAdjustEditorHeight($scope.paragraph.id + '_editor');
          $scope.changeHeight(height);
        }, 200);

    } else {
      $scope.changeHeight(height);
    }
  };

  $scope.changeHeight = function(height) {
    var newParams = angular.copy($scope.paragraph.settings.params);
    var newConfig = angular.copy($scope.paragraph.config);

    newConfig.graph.height = height;

    commitParagraph($scope.paragraph.title, $scope.paragraph.text, newConfig, newParams);
  };

  /** Utility function */
  if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function(str) {
      return this.slice(0, str.length) === str;
    };
  }

  $scope.goToSingleParagraph = function () {
    var noteId = $route.current.pathParams.noteId;
    var redirectToUrl = location.protocol + '//' + location.host + location.pathname + '#/notebook/' + noteId + '/paragraph/' + $scope.paragraph.id+'?asIframe';
    $window.open(redirectToUrl);
  };

  $scope.showScrollDownIcon = function(){
    var doc = angular.element('#p' + $scope.paragraph.id + '_text');
    if(doc[0]){
      return doc[0].scrollHeight > doc.innerHeight();
    }
    return false;
  };

  $scope.scrollParagraphDown = function() {
    var doc = angular.element('#p' + $scope.paragraph.id + '_text');
    doc.animate({scrollTop: doc[0].scrollHeight}, 500);
    $scope.keepScrollDown = true;
  };

  $scope.showScrollUpIcon = function(){
    if(angular.element('#p' + $scope.paragraph.id + '_text')[0]){
      return angular.element('#p' + $scope.paragraph.id + '_text')[0].scrollTop !== 0;
    }
    return false;

  };

  $scope.scrollParagraphUp = function() {
    var doc = angular.element('#p' + $scope.paragraph.id + '_text');
    doc.animate({scrollTop: 0}, 500);
    $scope.keepScrollDown = false;
  };

}]);

/* jshint loopfunc: true */
/*
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular
  .module('zeppelinWebApp')
  .controller('SearchResultCtrl', ["$scope", "$routeParams", "searchService", function($scope, $routeParams, searchService) {

  var results = searchService.search({'q': $routeParams.searchTerm}).query();

  results.$promise.then(function(result) {
    $scope.notes = result.body.map(function(note) {
      // redirect to notebook when search result is a notebook itself,
      // not a paragraph
      if (!/\/paragraph\//.test(note.id)) {
        return note;
      }

      note.id = note.id.replace('paragraph/', '?paragraph=') +
        '&term=' +
        $routeParams.searchTerm;

      return note;
    });
  });

  $scope.page = 0;
  $scope.allResults = false;

  $scope.highlightSearchResults = function(note) {
    return function(_editor) {
      function getEditorMode(text) {
        var editorModes = {
          'ace/mode/scala': /^%spark/,
          'ace/mode/sql': /^%(\w*\.)?\wql/,
          'ace/mode/markdown': /^%md/,
          'ace/mode/sh': /^%sh/
        };

        return Object.keys(editorModes).reduce(function(res, mode) {
          return editorModes[mode].test(text)? mode : res;
        }, 'ace/mode/scala');
      }

      var Range = ace.require('ace/range').Range;

      _editor.setOption('highlightActiveLine', false);
      _editor.$blockScrolling = Infinity;
      _editor.setReadOnly(true);
      _editor.renderer.setShowGutter(false);
      _editor.setTheme('ace/theme/chrome');
      _editor.getSession().setMode(getEditorMode(note.text));

      function getIndeces(term) {
        return function(str) {
          var indeces = [];
          var i = -1;
          while((i = str.indexOf(term, i + 1)) >= 0) {
            indeces.push(i);
          }
          return indeces;
        };
      }

      var lines = note.snippet
        .split('\n')
        .map(function(line, row) {
          var match = line.match(/<B>(.+?)<\/B>/);

        // return early if nothing to highlight
          if (!match) {
            return line;
          }

          var term = match[1];
          var __line = line
            .replace(/<B>/g, '')
            .replace(/<\/B>/g, '');

          var indeces = getIndeces(term)(__line);

          indeces.forEach(function(start) {
            var end = start + term.length;
            _editor
              .getSession()
              .addMarker(
                new Range(row, start, row, end),
                'search-results-highlight',
                'line'
              );
          });

          return __line;
        });

      // resize editor based on content length
      _editor.setOption(
        'maxLines',
        lines.reduce(function(len, line) {return len + line.length;}, 0)
      );

      _editor.getSession().setValue(lines.join('\n'));

    };
  };

}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').service('arrayOrderingSrv', function() {

  this.notebookListOrdering = function(note) {
    return (note.name ? note.name : 'Note ' + note.id);
  };

});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('zeppelinWebApp').controller('NavCtrl', ["$scope", "$rootScope", "$routeParams", "$location", "notebookListDataFactory", "websocketMsgSrv", "arrayOrderingSrv", function($scope, $rootScope, $routeParams,
    $location, notebookListDataFactory, websocketMsgSrv, arrayOrderingSrv) {
  /** Current list of notes (ids) */

  $scope.showLoginWindow = function() {
    setTimeout(function() {
      angular.element('#userName').focus();
    }, 500);
  };

  var vm = this;
  vm.notes = notebookListDataFactory;
  vm.connected = websocketMsgSrv.isConnected();
  vm.websocketMsgSrv = websocketMsgSrv;
  vm.arrayOrderingSrv = arrayOrderingSrv;
  if ($rootScope.ticket) {
    $rootScope.fullUsername = $rootScope.ticket.principal;
    $rootScope.truncatedUsername = $rootScope.ticket.principal;
  }

  var MAX_USERNAME_LENGTH=16;

  angular.element('#notebook-list').perfectScrollbar({suppressScrollX: true});

  $scope.$on('setNoteMenu', function(event, notes) {
    notebookListDataFactory.setNotes(notes);
  });

  $scope.$on('setConnectedStatus', function(event, param) {
    vm.connected = param;
  });

  $rootScope.$on('$locationChangeSuccess', function () {
    var path = $location.path();
    // hacky solution to clear search bar
    // TODO(felizbear): figure out how to make ng-click work in navbar
    if (path === '/') {
      $scope.searchTerm = '';
    }
  });

  $scope.checkUsername = function () {
    if ($rootScope.ticket) {
      if ($rootScope.ticket.principal.length <= MAX_USERNAME_LENGTH) {
        $rootScope.truncatedUsername = $rootScope.ticket.principal;
      }
      else {
        $rootScope.truncatedUsername = $rootScope.ticket.principal.substr(0, MAX_USERNAME_LENGTH) + '..';
      }
    }
  };

  $scope.$on('loginSuccess', function(event, param) {
    $scope.checkUsername();
    loadNotes();
  });

  $scope.search = function() {
    $location.url(/search/ + $scope.searchTerm);
  };

  function loadNotes() {
    websocketMsgSrv.getNotebookList();
  }

  function isActive(noteId) {
    return ($routeParams.noteId === noteId);
  }

  vm.loadNotes = loadNotes;
  vm.isActive = isActive;

  vm.loadNotes();
  $scope.checkUsername();

}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').directive('ngEscape', function() {
  return function(scope, element, attrs) {
    element.bind('keydown keyup', function(event) {
      if (event.which === 27) {
        scope.$apply(function() {
          scope.$eval(attrs.ngEscape);
        });
        event.preventDefault();
      }
    });
  };
});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('zeppelinWebApp').controller('NotenameCtrl', ["$scope", "notebookListDataFactory", "$rootScope", "$routeParams", "websocketMsgSrv", function($scope, notebookListDataFactory,
                                                             $rootScope, $routeParams, websocketMsgSrv) {
  var vm = this;
  vm.clone = false;
  vm.notes = notebookListDataFactory;
  vm.websocketMsgSrv = websocketMsgSrv;
  $scope.note = {};

  vm.createNote = function() {
      if (!vm.clone) {
        vm.websocketMsgSrv.createNotebook($scope.note.notename);
      } else {
       var noteId = $routeParams.noteId;
       vm.websocketMsgSrv.cloneNotebook(noteId, $scope.note.notename);
      }
  };

  vm.handleNameEnter = function(){
    angular.element('#noteNameModal').modal('toggle');
    vm.createNote();
  };

  vm.preVisible = function(clone) {
    $scope.note.notename = vm.newNoteName();
    vm.clone = clone;
    $scope.$apply();
  };

  vm.newNoteName = function () {
    var newCount = 1;
    angular.forEach(vm.notes.list, function (noteName) {
      noteName = noteName.name;
      if (noteName.match(/^Untitled Note [0-9]*$/)) {
        var lastCount = noteName.substr(14) * 1;
        if (newCount <= lastCount) {
          newCount = lastCount + 1;
        }
      }
    });
    return 'Untitled Note ' + newCount;
  };

}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('zeppelinWebApp').controller('NoteImportCtrl', ["$scope", "$timeout", "websocketMsgSrv", function($scope, $timeout, websocketMsgSrv) {
  var vm = this;
  $scope.note = {};
  $scope.note.step1 = true;
  $scope.note.step2 = false;

  vm.resetFlags = function() {
    $scope.note = {};
    $scope.note.step1 = true;
    $scope.note.step2 = false;
    angular.element('#noteImportFile').val('');
  };

  $scope.uploadFile = function() {
    angular.element('#noteImportFile').click();
  };

  $scope.importFile = function(element) {
    $scope.note.errorText = '';
    $scope.note.importFile = element.files[0];
    var file = $scope.note.importFile;
    var reader = new FileReader();

    reader.onloadend = function() {
      vm.processImportJson(reader.result);
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  $scope.uploadURL = function() {
    $scope.note.errorText = '';
    $scope.note.step1 = false;
    $timeout(function() {
      $scope.note.step2 = true;
    }, 400);
  };

  vm.importBack = function() {
    $scope.note.errorText = '';
    $timeout(function() {
      $scope.note.step1 = true;
    }, 400);
    $scope.note.step2 = false;
  };

  vm.importNote = function() {
    $scope.note.errorText = '';
    if ($scope.note.importUrl) {
      jQuery.getJSON($scope.note.importUrl, function(result) {
        vm.processImportJson(result);
      }).fail(function() {
        $scope.note.errorText = 'Unable to Fetch URL';
        $scope.$apply();
      });
    }
    else {
      $scope.note.errorText = 'Enter URL';
      $scope.$apply();
    }
  };

  vm.processImportJson = function(result) {
    if (typeof result !== 'object') {
      try {
        result = JSON.parse(result);
      } catch (e) {
        $scope.note.errorText = 'JSON parse exception';
        $scope.$apply();
        return;
      }

    }
    if (result.paragraphs && result.paragraphs.length > 0) {
      if (!$scope.note.noteImportName) {
        $scope.note.noteImportName = result.name;
      } else {
        result.name = $scope.note.noteImportName;
      }
      websocketMsgSrv.importNotebook(result);
      //angular.element('#noteImportModal').modal('hide');
    } else {
      $scope.note.errorText = 'Invalid JSON';
    }
    $scope.$apply();
  };

  $scope.$on('setNoteMenu', function(event, notes) {
    vm.resetFlags();
    angular.element('#noteImportModal').modal('hide');
  });
}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp')
  .directive('popoverHtmlUnsafePopup', function() {
    return {
      restrict: 'EA',
      replace: true,
      scope: { title: '@', content: '@', placement: '@', animation: '&', isOpen: '&' },
      templateUrl: 'components/popover-html-unsafe/popover-html-unsafe-popup.html'
    };
  })

  .directive('popoverHtmlUnsafe', ['$tooltip', function($tooltip) {
    return $tooltip('popoverHtmlUnsafe', 'popover', 'click');
  }]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').directive('ngEnter', function() {
  return function(scope, element, attrs) {
    element.bind('keydown keypress', function(event) {
      if (event.which === 13) {
        scope.$apply(function() {
          scope.$eval(attrs.ngEnter);
        });
        event.preventDefault();
      }
    });
  };
});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').directive('dropdownInput', function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            element.bind('click', function (event) {
                event.stopPropagation();
            });
        }
    };
});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').directive('resizable', function() {

  var resizableConfig = {
    autoHide: true,
    handles: 'se',
    helper: 'resizable-helper',
    stop: function() {
      angular.element(this).css({'width': '100%', 'height': '100%'});
    }
  };

  return {
    restrict: 'A',
    scope: {
      callback: '&onResize'
    },
    link: function postLink(scope, elem, attrs) {
      attrs.$observe('resize', function(resize) {
        var resetResize = function(elem, resize) {
          var colStep = window.innerWidth / 12;
          elem.off('resizestop');
          var conf = angular.copy(resizableConfig);
          if (resize.graphType === 'TABLE' || resize.graphType === 'TEXT') {
            conf.grid = [colStep, 10];
            conf.minHeight = 100;
          } else {
            conf.grid = [colStep, 10000];
            conf.minHeight = 0;
          }
          conf.maxWidth = window.innerWidth;

          elem.resizable(conf);
          elem.on('resizestop', function() {
            if (scope.callback) {
              var height = elem.height();
              if (height < 50) {
                height = 300;
              }
              scope.callback({width: Math.ceil(elem.width() / colStep), height: height});
            }
          });
        };

        resize = JSON.parse(resize);
        if (resize.allowresize === 'true') {
          resetResize(elem, resize);
          angular.element(window).resize(function() {
            resetResize(elem, resize);
          });
        }
      });
    }
  };
});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').directive('modalvisible', function () {
    return {
        restrict: 'A',
        scope: {
	        	preVisibleCallback: '&previsiblecallback',
	        	postVisibleCallback: '&postvisiblecallback',
	        	targetinput: '@targetinput'
        	   },
        link: function(scope, elem, attrs) {
        	// Add some listeners
    		var previsibleMethod = scope.preVisibleCallback;
    		var postVisibleMethod = scope.postVisibleCallback;
    		elem.on('show.bs.modal',function(e) {
    			var relatedTgt = angular.element(e.relatedTarget);
    			var clone = relatedTgt.data('clone');
    			var cloneNote = clone ? true : false;
    			previsibleMethod()(cloneNote);
    		});
    		elem.on('shown.bs.modal', function(e) {
    			if(scope.targetinput) {
    			  angular.element(e.target).find('input#' + scope.targetinput ).select();
    			}
    			postVisibleMethod();
    		});
        }
    };
});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').service('websocketMsgSrv', ["$rootScope", "websocketEvents", function($rootScope, websocketEvents) {

  return {

    getHomeNotebook: function() {
      websocketEvents.sendNewEvent({op: 'GET_HOME_NOTE'});
    },

    createNotebook: function(noteName) {
      websocketEvents.sendNewEvent({op: 'NEW_NOTE',data: {name: noteName}});
    },

    deleteNotebook: function(noteId) {
      websocketEvents.sendNewEvent({op: 'DEL_NOTE', data: {id: noteId}});
    },

    cloneNotebook: function(noteIdToClone, newNoteName ) {
      websocketEvents.sendNewEvent({op: 'CLONE_NOTE', data: {id: noteIdToClone, name: newNoteName}});
    },

    getNotebookList: function() {
      websocketEvents.sendNewEvent({op: 'LIST_NOTES'});
    },

    reloadAllNotesFromRepo: function() {
      websocketEvents.sendNewEvent({op: 'RELOAD_NOTES_FROM_REPO'});
    },

    getNotebook: function(noteId) {
      websocketEvents.sendNewEvent({op: 'GET_NOTE', data: {id: noteId}});
    },

    updateNotebook: function(noteId, noteName, noteConfig) {
      websocketEvents.sendNewEvent({op: 'NOTE_UPDATE', data: {id: noteId, name: noteName, config : noteConfig}});
    },

    moveParagraph: function(paragraphId, newIndex) {
      websocketEvents.sendNewEvent({ op: 'MOVE_PARAGRAPH', data : {id: paragraphId, index: newIndex}});
    },

    insertParagraph: function(newIndex) {
      websocketEvents.sendNewEvent({ op: 'INSERT_PARAGRAPH', data : {index: newIndex}});
    },

    updateAngularObject: function(noteId, paragraphId, name, value, interpreterGroupId) {
      websocketEvents.sendNewEvent({
        op: 'ANGULAR_OBJECT_UPDATED',
        data: {
          noteId: noteId,
          paragraphId: paragraphId,
          name: name,
          value: value,
          interpreterGroupId: interpreterGroupId
        }
      });
    },

    clientBindAngularObject: function(noteId, name, value, paragraphId) {
      websocketEvents.sendNewEvent({
        op: 'ANGULAR_OBJECT_CLIENT_BIND',
        data: {
          noteId: noteId,
          name: name,
          value: value,
          paragraphId: paragraphId
        }
      });
    },

    clientUnbindAngularObject: function(noteId, name, paragraphId) {
      websocketEvents.sendNewEvent({
        op: 'ANGULAR_OBJECT_CLIENT_UNBIND',
        data: {
          noteId: noteId,
          name: name,
          paragraphId: paragraphId
        }
      });
    },

    cancelParagraphRun: function(paragraphId) {
      websocketEvents.sendNewEvent({op: 'CANCEL_PARAGRAPH', data: {id: paragraphId}});
    },

    runParagraph: function(paragraphId, paragraphTitle, paragraphData, paragraphConfig, paragraphParams) {
      websocketEvents.sendNewEvent({
        op: 'RUN_PARAGRAPH',
        data: {
          id: paragraphId,
          title: paragraphTitle,
          paragraph: paragraphData,
          config: paragraphConfig,
          params: paragraphParams
        }
      });
    },

    removeParagraph: function(paragraphId) {
      websocketEvents.sendNewEvent({op: 'PARAGRAPH_REMOVE', data: {id: paragraphId}});
    },

    clearParagraphOutput: function(paragraphId) {
      websocketEvents.sendNewEvent({op: 'PARAGRAPH_CLEAR_OUTPUT', data: {id: paragraphId}});
    },

    completion: function(paragraphId, buf, cursor) {
      websocketEvents.sendNewEvent({
        op : 'COMPLETION',
        data : {
          id : paragraphId,
          buf : buf,
          cursor : cursor
        }
      });
    },

    commitParagraph: function(paragraphId, paragraphTitle, paragraphData, paragraphConfig, paragraphParams) {
      websocketEvents.sendNewEvent({
        op: 'COMMIT_PARAGRAPH',
        data: {
          id: paragraphId,
          title : paragraphTitle,
          paragraph: paragraphData,
          config: paragraphConfig,
          params: paragraphParams
        }
      });
    },

    importNotebook: function(notebook) {
      websocketEvents.sendNewEvent({
        op: 'IMPORT_NOTE',
        data: {
          notebook: notebook
        }
      });
    },

    checkpointNotebook: function(noteId, commitMessage) {
      websocketEvents.sendNewEvent({
        op: 'CHECKPOINT_NOTEBOOK',
        data: {
          noteId: noteId,
          commitMessage: commitMessage
        }
      });
    },

    isConnected: function(){
      return websocketEvents.isConnected();
    }

  };

}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').factory('websocketEvents', ["$rootScope", "$websocket", "$location", "baseUrlSrv", function($rootScope, $websocket, $location, baseUrlSrv) {
  var websocketCalls = {};

  websocketCalls.ws = $websocket(baseUrlSrv.getWebsocketUrl());
  websocketCalls.ws.reconnectIfNotNormalClose = true;

  websocketCalls.ws.onOpen(function() {
    console.log('Websocket created');
    $rootScope.$broadcast('setConnectedStatus', true);
    setInterval(function(){
      websocketCalls.sendNewEvent({op: 'PING'});
    }, 10000);
  });

  websocketCalls.sendNewEvent = function(data) {
    if ($rootScope.ticket !== undefined) {
      data.principal = $rootScope.ticket.principal;
      data.ticket = $rootScope.ticket.ticket;
      data.roles = $rootScope.ticket.roles;
    } else {
      data.principal = '';
      data.ticket = '';
      data.roles = '';
    }
    console.log('Send >> %o, %o, %o, %o, %o', data.op, data.principal, data.ticket, data.roles, data);
    websocketCalls.ws.send(JSON.stringify(data));
  };

  websocketCalls.isConnected = function() {
    return (websocketCalls.ws.socket.readyState === 1);
  };

  websocketCalls.ws.onMessage(function(event) {
    var payload;
    if (event.data) {
      payload = angular.fromJson(event.data);
    }
    console.log('Receive << %o, %o', payload.op, payload);
    var op = payload.op;
    var data = payload.data;
    if (op === 'NOTE') {
      $rootScope.$broadcast('setNoteContent', data.note);
    } else if (op === 'NEW_NOTE') {
      $location.path('notebook/' + data.note.id);
    } else if (op === 'NOTES_INFO') {
      $rootScope.$broadcast('setNoteMenu', data.notes);
    } else if (op === 'AUTH_INFO') {
      BootstrapDialog.alert({
        closable: true,
        title: 'Insufficient privileges',
        message: data.info.toString()
      });
    } else if (op === 'PARAGRAPH') {
      $rootScope.$broadcast('updateParagraph', data);
    } else if (op === 'PARAGRAPH_APPEND_OUTPUT') {
      $rootScope.$broadcast('appendParagraphOutput', data);
    } else if (op === 'PARAGRAPH_UPDATE_OUTPUT') {
      $rootScope.$broadcast('updateParagraphOutput', data);
    } else if (op === 'PROGRESS') {
      $rootScope.$broadcast('updateProgress', data);
    } else if (op === 'COMPLETION_LIST') {
      $rootScope.$broadcast('completionList', data);
    } else if (op === 'ANGULAR_OBJECT_UPDATE') {
      $rootScope.$broadcast('angularObjectUpdate', data);
    } else if (op === 'ANGULAR_OBJECT_REMOVE') {
      $rootScope.$broadcast('angularObjectRemove', data);
    }
  });

  websocketCalls.ws.onError(function(event) {
    console.log('error message: ', event);
    $rootScope.$broadcast('setConnectedStatus', false);
  });

  websocketCalls.ws.onClose(function(event) {
    console.log('close message: ', event);
    $rootScope.$broadcast('setConnectedStatus', false);
  });

  return websocketCalls;
}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').factory('notebookListDataFactory', function() {

  var notes = {
    root: {children: []},
    flatList: [],

    setNotes: function(notesList) {
      // a flat list to boost searching
      notes.flatList = angular.copy(notesList);

      // construct the folder-based tree
      notes.root = {children: []};
      _.reduce(notesList, function(root, note) {
        var noteName = note.name || note.id;
        var nodes = noteName.match(/([^\\\][^\/]|\\\/)+/g);

        // recursively add nodes
        addNode(root, nodes, note.id);

        return root;
      }, notes.root);
    }
  };

  var addNode = function(curDir, nodes, noteId) {
    if (nodes.length === 1) {  // the leaf
      curDir.children.push({
        name : nodes[0],
        id : noteId
      });
    } else {  // a folder node
      var node = nodes.shift();
      var dir = _.find(curDir.children,
        function(c) {return c.name === node && c.children !== undefined;});
      if (dir !== undefined) { // found an existing dir
        addNode(dir, nodes, noteId);
      } else {
        var newDir = {
          name : node,
          hidden : true,
          children : []
        };
        curDir.children.push(newDir);
        addNode(newDir, nodes, noteId);
      }
    }
  };

  return notes;
});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').service('baseUrlSrv', function() {

  this.getPort = function() {
    var port = Number(location.port);
    if (!port) {
      port = 80;
      if (location.protocol === 'https:') {
        port = 443;
      }
    }
    //Exception for when running locally via grunt
    if (port === 3333 || port === 9000) {
      port = 8080;
    }
    return port;
  };

  this.getWebsocketUrl = function() {
    var wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return wsProtocol + '//' + location.hostname + ':' + this.getPort() + skipTrailingSlash(location.pathname) + '/ws';
  };

  this.getRestApiBase = function() {
    return location.protocol + '//' + location.hostname + ':' + this.getPort() + skipTrailingSlash(location.pathname) + '/api';
  };

  var skipTrailingSlash = function(path) {
    return path.replace(/\/$/, '');
  };

});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').service('browserDetectService', function() {

  this.detectIE = function() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
      // IE 10 or older => return version number
      return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    }
    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
      // IE 11 => return version number
      var rv = ua.indexOf('rv:');
      return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    }
    var edge = ua.indexOf('Edge/');
    if (edge > 0) {
      // IE 12 (aka Edge) => return version number
      return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
    }
    // other browser
    return false;
  };

});

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').service('SaveAsService', ["browserDetectService", function(browserDetectService) {

  this.SaveAs = function(content, filename, extension) {
    if (browserDetectService.detectIE()) {
      angular.element('body').append('<iframe id="SaveAsId" style="display: none"></iframe>');
      var frameSaveAs = angular.element('body > iframe#SaveAsId')[0].contentWindow;
      frameSaveAs.document.open('text/json', 'replace');
      frameSaveAs.document.write(content);
      frameSaveAs.document.close();
      frameSaveAs.focus();
      var t1 = Date.now();
      frameSaveAs.document.execCommand('SaveAs', false, filename + '.' + extension);
      var t2 = Date.now();

      //This means, this version of IE dosen't support auto download of a file with extension provided in param
      //falling back to ".txt"
      if (t1 === t2) {
        frameSaveAs.document.execCommand('SaveAs', true, filename + '.txt');
      }
      angular.element('body > iframe#SaveAsId').remove();
    } else {
      content = 'data:image/svg;charset=utf-8,' + encodeURIComponent(content);
      angular.element('body').append('<a id="SaveAsId"></a>');
      var saveAsElement = angular.element('body > a#SaveAsId');
      saveAsElement.attr('href', content);
      saveAsElement.attr('download', filename + '.' + extension);
      saveAsElement.attr('target', '_blank');
      saveAsElement[0].click();
      saveAsElement.remove();
    }
  };

}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').service('searchService', ["$resource", "baseUrlSrv", function($resource, baseUrlSrv) {

  this.search = function(term) {
     console.log('Searching for: %o', term.q);
    if (!term.q) { //TODO(bzz): empty string check
      return;
    }
    var encQuery = window.encodeURIComponent(term.q);
    return $resource(baseUrlSrv.getRestApiBase()+'/notebook/search?q='+encQuery, {}, {
      query: {method:'GET'}
    });
  };

}]);

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('zeppelinWebApp').controller('LoginCtrl',
  ["$scope", "$rootScope", "$http", "$httpParamSerializer", "baseUrlSrv", function($scope, $rootScope, $http, $httpParamSerializer, baseUrlSrv) {
    $scope.loginParams = {};
    $scope.login = function() {

      $http({
        method: 'POST',
        url: baseUrlSrv.getRestApiBase() + '/login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: $httpParamSerializer({
          'userName': $scope.loginParams.userName,
          'password': $scope.loginParams.password
        })
      }).then(function successCallback(response) {
        $rootScope.ticket = response.data.body;
        angular.element('#loginModal').modal('toggle');
        $rootScope.$broadcast('loginSuccess', true);
      }, function errorCallback(errorResponse) {
        $scope.loginParams.errorText = 'The username and password that you entered don\'t match.';
      });

    };
  }]
);

(function (thisObj) {
    function buildUI(thisObj) {

        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "レイヤーアニメーションツール", undefined, { resizeable: true });
        if (win !== null) {
            win.orientation = "column";
            win.alignChildren = ["fill", "top"];
            win.margins = 10;

            var frameGroup = win.add("group");
            frameGroup.orientation = "row";
            frameGroup.add("statictext", undefined, "戻るまでのフレーム数:");
            var frameInput = frameGroup.add("edittext", undefined, "20");
            frameInput.characters = 5;

            var scaleGroup = win.add("group");
            scaleGroup.orientation = "row";
            scaleGroup.add("statictext", undefined, "移動距離倍率:");
            var moveScaleInput = scaleGroup.add("edittext", undefined, "1.0");
            moveScaleInput.characters = 5;

            var maskCheckbox = win.add("checkbox", undefined, "固定マスクを追加する"); 
            maskCheckbox.value = true;

            var applyBtn = win.add("button", undefined, "実行");

            applyBtn.onClick = function () {
                var comp = app.project.activeItem;
                if (!(comp instanceof CompItem)) {
                    alert("コンポジションを選択してください。");
                    return;
                }

                var frameOffset = parseInt(frameInput.text);
                if (isNaN(frameOffset) || frameOffset <= 0) {
                    alert("フレーム数が不正です。");
                    return;
                }

                var moveScale = parseFloat(moveScaleInput.text);
                if (isNaN(moveScale)) {
                    alert("移動距離倍率には数値を入力してください。");
                    return;
                }

                var timeOffset = frameOffset * comp.frameDuration;
                var selectedLayers = comp.selectedLayers;
                if (selectedLayers.length === 0) {
                    alert("レイヤーを選択してください。");
                    return;
                }

                app.beginUndoGroup("固定マスクとアニメーション追加");

                var mem_rand = 0;

                try {
                    for (var i = 0; i < selectedLayers.length; i++) {
                        var layer = selectedLayers[i];
                        var startTime = comp.time;
                        var endTime = startTime + timeOffset;

                        var sourceRect, w, h;
                        try {

                            sourceRect = layer.sourceRectAtTime(startTime, false); 
                            w = sourceRect.width; h = sourceRect.height;
                            if (w <= 0 || h <= 0) continue;
                        } catch(e) { continue; }

                        var rand;
                        do { rand = Math.floor(Math.random() * 4) + 1; } while (rand == mem_rand);
                        mem_rand = rand;
                        var initX = 0, initY = 0;
                        if (rand == 1) initX = -w * moveScale; if (rand == 2) initX = w * moveScale;
                        if (rand == 3) initY = -h * moveScale; if (rand == 4) initY = h * moveScale;

                        var posProp = layer.property("ADBE Transform Group").property("ADBE Position");
                        if (!posProp) continue; 

                        var currentPos = posProp.valueAtTime(startTime, false);
                        var initialPos = [currentPos[0] + initX, currentPos[1] + initY];

                        if (posProp.dimensionsSeparated) {
                             var posX = layer.property("ADBE Transform Group").property("ADBE Position_0");
                             var posY = layer.property("ADBE Transform Group").property("ADBE Position_1");
                             var currentPosX = posX.valueAtTime(startTime, false); var currentPosY = posY.valueAtTime(startTime, false);

                             posX.setValueAtTime(startTime, currentPosX + initX); posY.setValueAtTime(startTime, currentPosY + initY);
                             posX.setValueAtTime(endTime, currentPosX); posY.setValueAtTime(endTime, currentPosY);
                        } else {
                            posProp.setValueAtTime(startTime, initialPos); posProp.setValueAtTime(endTime, currentPos);
                        }

                        if (maskCheckbox.value) {

                            var mask = layer.Masks.addProperty("ADBE Mask Atom");
                            mask.name = "Fixed Position Mask"; 
                            mask.maskMode = MaskMode.SUBTRACT; 

                            var maskPath = mask.property("ADBE Mask Shape");
                            var expressionString = [
                                'try {',
                                '  var pos = thisLayer.transform.position;', 
                                '  if (pos.numKeys >= 2) {', 
                                '    var startTime = pos.key(1).time;',         
                                '    var startPos = pos.key(1).value;',         
                                '    var endTime = pos.key(2).time;',           
                                '',
                                '    // endTime (アニメーション終了時) のソース矩形を基準のマスク形状とする',
                                '    var rect = thisLayer.sourceRectAtTime(endTime, false);',
                                '    var x = rect.left;',
                                '    var y = rect.top;',
                                '    var w = rect.width;',
                                '    var h = rect.height;',
                                '    var baseVertices = [[x,y], [x+w,y], [x+w,y+h], [x,y+h]];',
                                '    // タンジェントも sourceRectAtTime から取得した方が正確だが、多くの場合 [0,0] で十分',
                                '    var baseInTangents = [[0,0],[0,0],[0,0],[0,0]];',
                                '    var baseOutTangents = [[0,0],[0,0],[0,0],[0,0]];',
                                '    var baseClosed = true;',
                                '',
                                '    // 現在の位置を取得',
                                '    var currentPos = pos.valueAtTime(time);',
                                '',
                                '    // アニメーション開始からの移動量',
                                '    var offset = sub(currentPos, startPos);',
                                '    var invertedOffset = [-offset[0], -offset[1]];', 
                                '',
                                '    // ベース形状の頂点を移動量でオフセット',
                                '    var newVertices = [];',
                                '    for (var i = 0; i < baseVertices.length; i++) {',
                                '      newVertices.push(add(baseVertices[i], invertedOffset));',
                                '    }',
                                '',
                                '    createPath(newVertices, baseInTangents, baseOutTangents, baseClosed);',
                                '  } else {',
                                '    value; // キーが2つ未満の場合は元の値',
                                '  }',
                                '} catch (e) {',
                                '  value; // エラー発生時も元の値',
                                '}'
                            ].join('\n');

                            maskPath.expression = expressionString;

                            try {
                                var endRect = layer.sourceRectAtTime(endTime, false);
                                var endShape = new Shape();
                                endShape.vertices = [[endRect.left, endRect.top], [endRect.left + endRect.width, endRect.top], [endRect.left + endRect.width, endRect.top + endRect.height], [endRect.left, endRect.top + endRect.height]];
                                endShape.inTangents = [[0,0],[0,0],[0,0],[0,0]];
                                endShape.outTangents = [[0,0],[0,0],[0,0],[0,0]];
                                endShape.closed = true;
                                maskPath.setValue(endShape); 
                            } catch(e){}

                        }
                    }
                } catch(e) {
                     alert("エラーが発生しました: " + e.toString() + "\nLine: " + e.line);
                } finally {
                    app.endUndoGroup();
                }
            };

            win.layout.layout(true);
            win.onResize = function () { win.layout.resize(); }
        }
        return win;
    }

    var myScriptPal = buildUI(thisObj);
    if (myScriptPal !== null && myScriptPal instanceof Window) {
        myScriptPal.center();
        myScriptPal.show();
    }

})(this);


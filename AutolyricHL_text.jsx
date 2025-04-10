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

            var maskCheckbox = win.add("checkbox", undefined, "マスクを追加する");
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

                app.beginUndoGroup("マスクとアニメーション追加");

                var mem_rand = 0;

                try { 
                    for (var i = 0; i < selectedLayers.length; i++) {
                        var layer = selectedLayers[i];

                        var isText = false;
                        try {
                            isText = layer.property("ADBE Text Properties") != null;
                        } catch (e) {  }

                        var sourceRect, x, y, w, h;
                        try {
                            sourceRect = layer.sourceRectAtTime(comp.time, false);
                            x = sourceRect.left;
                            y = sourceRect.top;
                            w = sourceRect.width;
                            h = sourceRect.height;

                            if (w <= 0 || h <= 0) {

                                continue;
                            }
                        } catch(e) {

                            continue; 
                        }

                        if (maskCheckbox.value) {
                            var maskShape = new Shape();
                            maskShape.vertices = [
                                [x, y],
                                [x + w, y],
                                [x + w, y + h],
                                [x, y + h]
                            ];
                            maskShape.closed = true;

                            maskShape.inTangents = [[0,0],[0,0],[0,0],[0,0]];
                            maskShape.outTangents = [[0,0],[0,0],[0,0],[0,0]];

                            var mask = layer.Masks.addProperty("ADBE Mask Atom");
                            mask.maskShape.setValue(maskShape);
                        }

                        var rand;
                        do {
                            rand = Math.floor(Math.random() * 4) + 1;
                        } while (rand == mem_rand); 
                        mem_rand = rand;

                        var initX = 0, initY = 0;
                        if (rand == 1) initX = -w * moveScale;
                        if (rand == 2) initX = w * moveScale;
                        if (rand == 3) initY = -h * moveScale;
                        if (rand == 4) initY = h * moveScale;

                        var startTime = comp.time;
                        var endTime = startTime + timeOffset;

                        if (isText) {
                            var textProp = layer.property("ADBE Text Properties").property("ADBE Text Animators");

                            if (textProp.property("AutoPosition")) {
                                textProp.property("AutoPosition").remove();
                            }
                            var animator = textProp.addProperty("ADBE Text Animator");
                            animator.name = "AutoPosition";
                            var positionProp = animator.property("ADBE Text Animator Properties").addProperty("ADBE Text Position 3D");

                            positionProp.setValueAtTime(startTime, [initX, initY, 0]);
                            positionProp.setValueAtTime(endTime, [0, 0, 0]);

                        } else {

                             if (layer.property("ADBE Transform Group") && layer.property("ADBE Transform Group").property("ADBE Position")) {
                                var pos = layer.property("ADBE Transform Group").property("ADBE Position");

                                var currentPos = pos.valueAtTime(startTime, false); 
                                var initPos = [currentPos[0] + initX, currentPos[1] + initY];

                                if (pos.dimensionsSeparated) {
                                     var posX = layer.property("ADBE Transform Group").property("ADBE Position_0");
                                     var posY = layer.property("ADBE Transform Group").property("ADBE Position_1");
                                     var currentPosX = posX.valueAtTime(startTime, false);
                                     var currentPosY = posY.valueAtTime(startTime, false);
                                     posX.setValueAtTime(startTime, currentPosX + initX);
                                     posY.setValueAtTime(startTime, currentPosY + initY);
                                     posX.setValueAtTime(endTime, currentPosX);
                                     posY.setValueAtTime(endTime, currentPosY);
                                } else {
                                    pos.setValueAtTime(startTime, initPos);
                                    pos.setValueAtTime(endTime, currentPos); 
                                }
                            } else {

                                continue;
                            }
                        }
                    } 
                } catch(e) {
                     alert("エラーが発生しました: " + e.toString() + "\nLine: " + e.line); 
                } finally {
                    app.endUndoGroup(); 
                }
            }; 

            win.layout.layout(true); 
            win.onResize = function () { 
                win.layout.resize();
            }

        } 

        return win;
    } 

    var myScriptPal = buildUI(thisObj);

    if (myScriptPal !== null && myScriptPal instanceof Window) {
        myScriptPal.center();
        myScriptPal.show();
    }

})(this);
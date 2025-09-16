export {
    resize_canvas,
    export_svg,
    enable_button_selection,
    disable_button_selection,
    prevent_leaving_canvas,
    wheel_zoom,
    reset_zoom,
    stop_pan,
    start_pan,
    move_pan,
    init_floor_plan
};


const resize_canvas = (canvas, window) => {
    const bob_width = $("#content-container").width();
    const window_width = Math.min($(window).width(), bob_width);
    const window_height = $(window).height();
    const canvas_width = window_width;
    const canvas_height = window_height - 100;
    canvas.setWidth(canvas_width);
    canvas.setHeight(canvas_height);
//    canvas.backgroundImage.scaleToWidth(canvas_width);
//    canvas.backgroundImage.scaleToHeight(canvas_height);
    canvas.renderAll();
}

const reset_zoom = (canvas) => {
    const objs = canvas.getObjects();
    for (let i = 0; i < objs.length; i++) {
        if (objs[i].custom_meta) {
            if (objs[i].custom_meta.object_type == "floorplan_boundry") {
                canvas.setActiveObject(objs[i]);
                let pan_x = 0
                let pan_y = 0
                const object = canvas.getActiveObject()
                const obj_wdth = object.getScaledWidth()
                const obj_hgt = object.getScaledHeight()
                const rect_cooords = object.getBoundingRect();
                const zoom_level = Math.min(canvas.width / rect_cooords.width, canvas.height / rect_cooords.height);

                canvas.setZoom(zoom_level * 0.7);
                const zoom = canvas.getZoom()
                //pan_x = ((canvas.getWidth() / zoom / 2) - (object.aCoords.tl.x) - (obj_wdth / 2)) * zoom
                //pan_y = ((canvas.getHeight() / zoom / 2) - (object.aCoords.tl.y) - (obj_hgt / 2)) * zoom
                pan_x = (canvas.getVpCenter().x - object.getCenterPoint().x) * zoom
                pan_y = ((canvas.getVpCenter().y - object.getCenterPoint().y) * zoom)
                canvas.relativePan({ x: pan_x, y: pan_y })
                canvas.requestRenderAll()
                canvas.discardActiveObject();
            }
        }
    }
}

const export_svg = (canvas) => {
    const filedata = canvas.toSVG();
    const locfile = new Blob([filedata], { type: "image/svg+xml;charset=utf-8" });
    const locfilesrc = URL.createObjectURL(locfile);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = locfilesrc;
    link.download = "floorplan.svg";
    link.click();
}

const enable_button_selection = () => {
    document.getElementById("selected_color").value = "#000000";
    $(".tools").removeClass("disabled");
}

const disable_button_selection = () => {
    // set color to default
    document.getElementById("selected_color").value = "#000000";
    $(".tools").addClass("disabled");
}

const prevent_leaving_canvas = (e, canvas) => {
    const obj = e.target;
    obj.setCoords();
    const current_zoom = obj.canvas.getZoom();
    if (obj.getScaledHeight() > obj.canvas.height || obj.getScaledWidth() > obj.canvas.width) {
        return;
    }
    if (obj.getBoundingRect().top < 0 || obj.getBoundingRect().left < 0) {
        obj.top = Math.max(obj.top * current_zoom, obj.top * current_zoom - obj.getBoundingRect().top) / current_zoom;
        obj.left = Math.max(obj.left * current_zoom, obj.left * current_zoom - obj.getBoundingRect().left) / current_zoom;
    }
    if (obj.getBoundingRect().top + obj.getBoundingRect().height > obj.canvas.height || obj.getBoundingRect().left + obj.getBoundingRect().width > obj.canvas.width) {
        obj.top = Math.min(obj.top * current_zoom, obj.canvas.height - obj.getBoundingRect().height + obj.top * current_zoom - obj.getBoundingRect().top) / current_zoom;
        obj.left = Math.min(obj.left * current_zoom, obj.canvas.width - obj.getBoundingRect().width + obj.left * current_zoom - obj.getBoundingRect().left) / current_zoom;
    }
};

const wheel_zoom = (opt, canvas) => {
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
}

const stop_pan = (canvas) => {
    canvas.setViewportTransform(canvas.viewportTransform);
    canvas.isDragging = false;
    canvas.selection = true;
}

const start_pan = (opt, canvas) => {
    const evt = opt.e;
    if (evt.altKey !== true) return;
        
    canvas.isDragging = true;
    canvas.selection = false;
    canvas.lastPosX = evt.clientX;
    canvas.lastPosY = evt.clientY;
}

const move_pan = (opt, canvas) => {
    if (!canvas.isDragging) return;

    const e = opt.e;
    const vpt = canvas.viewportTransform;
    vpt[4] += e.clientX - canvas.lastPosX;
    vpt[5] += e.clientY - canvas.lastPosY;
    canvas.requestRenderAll();
    canvas.lastPosX = e.clientX;
    canvas.lastPosY = e.clientY;
}

const init_floor_plan = (floorplan_id, canvas, mode) => {
    if (floorplan_id === undefined || floorplan_id === null || floorplan_id === "") {
        return;
    }

    let target_image = 0;
    const floorplan_call = $.get(`/api/plugins/floorplan/floorplans/?id=${floorplan_id}`);
    floorplan_call.done((floorplan) => {
        floorplan.results.forEach((floorplan) => {
            target_image = floorplan.assigned_image
            canvas.loadFromJSON(JSON.stringify(floorplan.canvas), canvas.renderAll.bind(canvas), (o, object) => {
                if (mode == "readonly") {
                    object.set('selectable', false);
                }
                if (floorplan.assigned_image == null) {
                    canvas.setBackgroundImage().renderAll();
                    canvas.renderAll();
                    return;
                }

                let img_url = floorplan.assigned_image.file;
                if (floorplan.assigned_image.external_url != "") {
                    img_url = floorplan.assigned_image.external_url;
                } 

                fabric.Image.fromURL(img_url, (img) => {
                    let left = 0;
                    let top = 0;
                    let width = 0;
                    let height = 0;
                    canvas.getObjects().forEach(function (object) {
                        if (object.custom_meta) {
                            if (object.custom_meta.object_type == "floorplan_boundry") {
                                left = object.left;
                                top = object.top;
                                width = object.width;
                                height = object.height;
                            }
                        }
                    });
                    // if we have a floorplan boundary, position the image in there 
                    if (height != 0 && width != 0) {
                        let scaleRatioX = Math.max(width / img.width)
                        let scaleRatioY = Math.max(height / img.height);
                        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                            scaleX: scaleRatioX,
                            scaleY: scaleRatioY,
                            left: left,
                            top: top
                        });     
                    }
                    else
                    {
                        let scaleRatio = Math.max(canvas.width / img.width, canvas.height / img.height);
                        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                            scaleX: scaleRatio,
                            scaleY: scaleRatio,
                            left: canvas.width / 2,
                            top: canvas.height / 2,
                            originX: 'middle',
                            originY: 'middle'
                        });
                    }
                });
                
                canvas.renderAll();
            });
        });
        reset_zoom(canvas);
        resize_canvas(canvas, window);
    }).fail(function (jq_xhr, text_status, error_thrown) {
        console.log(`error: ${error_thrown} - ${text_status}`);
    });
};

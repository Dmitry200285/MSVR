'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
const { cos, sin, sqrt, pow, tan, PI } = Math
let stereoCamera;
let converg = 5, eyeSep = 0.8, foView = 30, ncDist = 1;
let texture1, texture2, surface2, allowedCamera;

function deg2rad(angle) {
    return angle * PI / 180;
}

// Constructor
function StereoCamera(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance
) {
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = deg2rad(FOV);
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;

    this.ApplyLeftFrustum = function () {
        let top, bottom, left, right;

        top = this.mNearClippingDistance * tan(this.mFOV / 2);
        bottom = -top;

        const a = this.mAspectRatio * tan(this.mFOV / 2) * this.mConvergence;

        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        left = -b * this.mNearClippingDistance / this.mConvergence;
        right = c * this.mNearClippingDistance / this.mConvergence;

        const projection = m4.frustum(left, right, bottom, top,
            this.mNearClippingDistance, this.mFarClippingDistance)
        const modelview = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0)
        return [projection, modelview]
    }

    this.ApplyRightFrustum = function () {
        let top, bottom, left, right;

        top = this.mNearClippingDistance * tan(this.mFOV / 2);
        bottom = -top;

        const a = this.mAspectRatio * tan(this.mFOV / 2) * this.mConvergence;

        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        left = -c * this.mNearClippingDistance / this.mConvergence;
        right = b * this.mNearClippingDistance / this.mConvergence;

        const projection = m4.frustum(left, right, bottom, top,
            this.mNearClippingDistance, this.mFarClippingDistance);
        const modelview = m4.translation(-this.mEyeSeparation / 2, 0.0, 0.0);
        return [projection, modelview]
    }
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextureBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function (vertices, textures) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }

    this.Draw = function () {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexture, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexture);

        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(PI / 8, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    // let modelViewProjection = m4.multiply(projection, matAccum1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        allowedCamera
    );
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, m4.identity());
    surface2.Draw();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    let [pM, mM] = stereoCamera.ApplyLeftFrustum()
    let modelViewProjection = m4.multiply(pM, m4.multiply(mM, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(true, false, false, false);
    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
    surface.Draw();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    [pM, mM] = stereoCamera.ApplyRightFrustum()
    modelViewProjection = m4.multiply(pM, m4.multiply(mM, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(false, true, true, false);
    surface.Draw();

    gl.colorMask(true, true, true, true);
}

function draw2() {
    draw()
    window.requestAnimationFrame(draw2)
}

function r(u, z) {
    return sqrt(c(z) * c(z) * cos(2 * u) + sqrt(pow(a, 4) - pow(c(z), 4) * pow(sin(2 * u), 2)))
}
function c(z) {
    return 3 * z;
}

const a = 8
const scaler = 0.1;

function cassiniVertex(u, z) {
    // console.log(r(u, z))
    let x = r(u, z) * cos(u),
        y = r(u, z) * sin(u),
        cZ = z;
    return [scaler * x, scaler * y, scaler * cZ];
}

function CreateTextures() {
    let textureList = [];
    const NUM_STEPS_U = 50,
        NUM_STEPS_Z = 50;
    for (let u = 0; u < NUM_STEPS_U; u++) {
        for (let z = 0; z < NUM_STEPS_Z; z++) {
            textureList.push(u / NUM_STEPS_U, z / NUM_STEPS_Z)
            textureList.push((u + 1) / NUM_STEPS_U, z / NUM_STEPS_Z)
            textureList.push(u / NUM_STEPS_U, (z + 1) / NUM_STEPS_Z)
            textureList.push(u / NUM_STEPS_U, (z + 1) / NUM_STEPS_Z)
            textureList.push((u + 1) / NUM_STEPS_U, z / NUM_STEPS_Z)
            textureList.push((u + 1) / NUM_STEPS_U, (z + 1) / NUM_STEPS_Z)
        }
    }
    return textureList;
}

function CreateSurfaceData() {
    let vertexList = [];
    const NUM_STEPS_U = 50,
        NUM_STEPS_Z = 50,
        MAX_U = PI * 2,
        MAX_Z = 3,
        STEP_U = MAX_U / NUM_STEPS_U,
        STEP_Z = 2 * MAX_Z / NUM_STEPS_Z
    for (let u = 0; u < MAX_U; u += STEP_U) {
        for (let z = -3; z < MAX_Z; z += STEP_Z) {
            let vertex = cassiniVertex(u, z)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u + STEP_U, z)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u, z + STEP_Z)
            vertexList.push(...vertex)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u + STEP_U, z)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u + STEP_U, z + STEP_Z)
            vertexList.push(...vertex)
        }
    }
    return vertexList;
}

/* Initialize the WebGL context. Called from init() */
let convergInput, eyeSepInput, foViewInput, ncDistInput;
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexture = gl.getAttribLocation(prog, "texture");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iTMU = gl.getUniformLocation(prog, 'tmu');
    convergInput = document.getElementById('converg')
    eyeSepInput = document.getElementById('eyeSep')
    foViewInput = document.getElementById('foView')
    ncDistInput = document.getElementById('ncDist')
    convergInput.addEventListener("change", () => {
        converg = convergInput.value
        stereoCamera.mConvergence = converg
        draw()
    })
    eyeSepInput.addEventListener("change", () => {
        eyeSep = eyeSepInput.value
        stereoCamera.mEyeSeparation = eyeSep
        draw()
    })
    foViewInput.addEventListener("change", () => {
        foView = deg2rad(foViewInput.value)
        stereoCamera.mFOV = foView
        draw()
    })
    ncDistInput.addEventListener("change", () => {
        ncDist = ncDistInput.value
        stereoCamera.mNearClippingDistance = parseFloat(ncDistInput.value)
        console.log(stereoCamera.mNearClippingDistance)
        draw()
    })
    stereoCamera = new StereoCamera(converg, eyeSep, 1, foView, ncDist, 12)
    LoadTexture();
    texture2 = CreateTexture();

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData(), CreateTextures());
    surface2 = new Model('Surface2');
    surface2.BufferData([1, 1, 0, -1, -1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0], // vertex3
        [0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1]); // texture2

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    allowedCamera = askCamera();
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }


    spaceball = new TrackballRotator(canvas, draw, 0);

    draw2();
}

function LoadTexture() {
    texture1 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const image = new Image();
    image.crossOrigin = 'anonymus';
    image.src = "https://raw.githubusercontent.com/Dmitry200285/Vgg/CGW/Projection.png";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture1);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        console.log("imageLoaded")
        draw()
    }
}
function CreateTexture() {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}
function askCamera() {
    const video = document.createElement('video');
    navigator.getUserMedia({ video: true, audio: false }, function (stream) {
        video.srcObject = stream;
    }, function (e) {
        console.error('Rejected!', e);
    });
    video.setAttribute('autoplay', true);
    return video;
}
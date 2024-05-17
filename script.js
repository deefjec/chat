
const apiUrl = 'https://corsproxy.io/?https://api.anthropic.com/v1/messages';

const jsonify = (almostJson) => {
    try {
        return JSON.parse(almostJson);
    } catch (e) {
        almostJson = almostJson.replace(/([a-zA-Z0-9_$]+\s*):/g, '"$1":').replace(/'([^']+?)'([\s,\]\}])/g, '"$1"$2');
        return JSON.parse(almostJson);
    }
};

const chars = {
    '[': ']',
    '{': '}'
};

const any = (iteree, iterator) => {
    let result;
    for (let i = 0; i < iteree.length; i++) {
        result = iterator(iteree[i], i, iteree);
        if (result) {
            break;
        }
    }
    return result;
};

const extract = (str) => {
    let startIndex = str.search(/[\{\[]/);
    if (startIndex === -1) {
        return null;
    }

    let openingChar = str[startIndex];
    let closingChar = chars[openingChar];
    let endIndex = -1;
    let count = 0;

    str = str.substring(startIndex);
    any(str, (letter, i) => {
        if (letter === openingChar) {
            count++;
        } else if (letter === closingChar) {
            count--;
        }

        if (!count) {
            endIndex = i;
            return true;
        }
    });

    if (endIndex === -1) {
        return null;
    }

    let obj = str.substring(0, endIndex + 1);
    return obj;
};

const jsons = (str) => {
    let result;
    const objects = [];
    while ((result = extract(str)) !== null) {
        try {
            let obj = jsonify(result);
            objects.push(obj);
        } catch (e) {
            // Do nothing
        }
        str = str.replace(result, '');
    }

    return objects;
};



document.addEventListener("DOMContentLoaded", function () {
    const inputContainer = document.getElementById("inputContainer");
    const printBtn = document.getElementById("printBtn");
    const addBtn = document.getElementById("addBtn");
    const clearBtn = document.getElementById("clearBtn");
    const systemArea = document.getElementById("systemArea");
    const systemPrompt = document.createElement("textarea");
    systemPrompt.placeholder = "Enter systemPrompt";
    systemPrompt.rows = "5"; // Adjust rows for multiline input
    if (localStorage.systemPrompt) {
        systemPrompt.value = localStorage.systemPrompt;
    }
    systemArea.appendChild(systemPrompt);

    const seed = document.createElement("textarea");
    seed.placeholder = "Enter seed";
    seed.rows = "3"; // Adjust rows for multiline input
    if (localStorage.seed) {
        seed.value = localStorage.seed;
    }
    systemArea.appendChild(seed);

    const apikey = document.createElement("textarea");
    apikey.placeholder = "Enter api key";
    if (localStorage.apikey) {
        apikey.value = localStorage.apikey;
    }
    systemArea.appendChild(apikey);  
    var claudeReply = "";

    if (localStorage.allContents){
        ac = JSON.parse(localStorage.allContents);
            for (i = 0; i < ac.length; i++){
                addbox(i, ac[i]);
            }
    }




    function process(chunk) {
        if (chunk) {
            var x = jsons(chunk);
            for (var i = 0; i < x.length; i++) {
                var test = x[i]?.delta?.text;
                if (test) {
                    claudeReply += test;
                }
            }
        }
    }


    function readStream(reader, lastInput) {
        const x = reader.read();
        x.then(v => {

            const chunk = v.value;
            console.log(chunk);

            process(chunk)
            lastInput.value = claudeReply;
            if (v?.done) {
                lastInput.value = claudeReply.trim();
                saveInputs();
                return;
            }
            readStream(reader, lastInput);
        });
    }


    function addbox(index, val){
        const userInput = document.createElement("textarea");
        userInput.placeholder = "Enter text";
        userInput.rows = index % 2 ? 15 : 5;
        inputContainer.appendChild(userInput);
        userInput.value = val;

    }

    function saveInputs(){
        const inputs = document.querySelectorAll("#inputContainer textarea");

        const allContents = Array.from(inputs).map(input => input.value);
        localStorage.allContents = JSON.stringify(allContents);
    }



    // Function to fill the last box with contents of all previous boxes
    function fillLastBox() {
        const inputs = document.querySelectorAll("#inputContainer textarea");
        const allContents = Array.from(inputs).map(input => input.value);
        const lastInput = inputs[inputs.length - 1];
        claudeReply = lastInput.value;


        localStorage.systemPrompt = systemPrompt.value;
        localStorage.seed = seed.value;
        localStorage.apikey = apikey.value;


        var messages = [];
        for (i = 0; i < allContents.length; i++) {
            if (i % 2 == 1) {
                messages[i] = { role: "assistant", content: localStorage.seed + allContents[i] };
            }
            else {
                messages[i] = { role: "user", content: allContents[i] };
            }
        }

        var msg = {
            system: localStorage.systemPrompt,
            model: document.querySelector('input[name = version]:checked').value,
            max_tokens: 2048,
            messages: messages,
            stream: true
        };

        fetch(apiUrl, {

            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': localStorage.apikey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(msg)
        })
            .then(response => readStream(response.body?.pipeThrough(new TextDecoderStream()).getReader(), lastInput))
            //.then(data => {
            //    console.log("hello");
            //    const claudeReply = data.content[0].text;
            //    lastInput.value = claudeReply.trim();
            .catch(error => {
                lastInput.value = 'Error: ' + error.message;
            });


    }





    printBtn.addEventListener("click", fillLastBox);

    clearBtn.addEventListener("click", function (){
        const inputs = document.querySelectorAll("#inputContainer textarea");

        const allContents = Array.from(inputs).map(input => input.value);
        localStorage.allContents = JSON.stringify(allContents.slice(0,-2));
        location.reload();

    })

    addBtn.addEventListener("click", function () {
        const userInput = document.createElement("textarea");
        userInput.placeholder = "Enter text";
        userInput.rows = "5";
        const output = document.createElement("textarea");
        output.placeholder = "claude:" // Adjust rows for multiline input
        output.rows = 10;

        inputContainer.appendChild(userInput);
        inputContainer.appendChild(output);
    });
}
);

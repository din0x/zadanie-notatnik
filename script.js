console.log('js loaded');
fetch("/api/write/10", { method: "POST", body: "hello from client" } );

const write = (id, text) => {
    return fetch(`/api/write/${id}`, { method: "POST", body: text } );
};

const name = document.getElementById("name");
name.value = "";

const addNote = (id, text) => {
    document.getElementById("notes").innerHTML += `
        <div id="note-${id}" class="note">
            <h1>${id}</h1>
            <textarea>${text}</textarea>
        </div>
    `;

    const textarea = document.querySelector(`#note-${id}>textarea`);
    console.log(textarea);
    textarea.addEventListener("change", e => {
        console.log(e);
        write(id, e.target.value);
    });
}

(async () => {
    const notes = await (await fetch("/api/get")).json();
    console.log(notes);

    for (const id of notes) {
        const text = await (await fetch(`/api/read/${id}`)).text();
        addNote(id, text);
    }
})();

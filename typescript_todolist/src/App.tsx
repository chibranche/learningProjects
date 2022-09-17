import React from "react";
import TodoList from "./components/TodoList";

import "./App.css";

function App() {
    return (
        <div className="App">
            <header className="App-header">Typescript Todo List</header>
            <div>
                <TodoList />
            </div>
        </div>
    );
}

export default App;

import React, { useState } from "react";

function TodoList() {
    const [todos, setTodos] = useState<Array<Todo>>([]);
    const [newTodoValue, setNewTodoValue] = useState<string>("");

    const toggleComplete: ToggleComplete = (selectedTodo) => {
        const newTodos = todos.map((todo) => {
            if (todo === selectedTodo) {
                return {
                    ...todo,
                    complete: !todo.complete,
                };
            }
            return todo;
        });
        setTodos(newTodos);
    };

    const addTodo: AddTodo = (newTodo) => {
        if (newTodo !== "") {
            setTodos([...todos, { text: newTodo, complete: false }]);
            setNewTodoValue("");
        }
    };

    return (
        <div>
            <ul className="todolist-container">
                {todos.map((todo, index) => {
                    return (
                        <li key={index} className={`flex-row ${todo.complete ? "todo-item-complete" : ""}`}>
                            <input type="checkbox" checked={todo.complete} onChange={() => toggleComplete(todo)} />
                            <p>{todo.text}</p>
                        </li>
                    );
                })}
            </ul>

            <div>
                <p>Add todo</p>
                <input type="text" value={newTodoValue} onChange={(e) => setNewTodoValue(e.target.value)} />
                <button onClick={() => addTodo(newTodoValue)}>Add</button>
            </div>
        </div>
    );
}

export default TodoList;

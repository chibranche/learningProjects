import React from "react";

type GreetProps = {
    name?: string;
};

function Greet({ name = "World" }: GreetProps) {
    return <div>Hello {name}</div>;
}

export default Greet;

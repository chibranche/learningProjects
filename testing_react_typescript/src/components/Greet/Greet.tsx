import React from "react";
import { GreetProps } from "./greet.types";

function Greet({ name = "World" }: GreetProps) {
    return <div>Hello {name ? name : "Guest"}</div>;
}

export default Greet;

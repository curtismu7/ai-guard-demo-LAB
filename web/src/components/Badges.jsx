import React from "react";

// Provenance and honesty badges. They sit next to anything that shows detection or gateway behaviour.
export const StandIn = ({ children = "STAND-IN" }) => (
  <span className="badge badge-info" title="A deterministic keyword stand-in for a real classifier. It says nothing about any product's detection quality.">{children}</span>
);
export const Demo = () => <span className="badge badge-demo" data-testid="demo-badge" title="Nothing real is touched: no model, no network.">DEMO</span>;

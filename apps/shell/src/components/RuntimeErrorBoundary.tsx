import { Component } from "react";
import type { ErrorInfo, PropsWithChildren } from "react";

import { logger } from "../app/logger";
import {
  createRuntimeIncident,
  type RuntimeIncident,
} from "../app/runtimeError";
import "./runtime-error-boundary.css";

interface RuntimeErrorBoundaryState {
  incident: RuntimeIncident | null;
}

export class RuntimeErrorBoundary extends Component<
  PropsWithChildren,
  RuntimeErrorBoundaryState
> {
  public state: RuntimeErrorBoundaryState = {
    incident: null,
  };

  public static getDerivedStateFromError(
    error: unknown,
  ): RuntimeErrorBoundaryState {
    return {
      incident: createRuntimeIncident(error),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const incident = this.state.incident ?? createRuntimeIncident(error);

    void logger.error("React render boundary captured an incident", {
      incident,
      componentStack: errorInfo.componentStack,
    });
  }

  public render() {
    const { incident } = this.state;

    if (!incident) {
      return this.props.children;
    }

    return (
      <main className="runtime-fault" role="alert" aria-live="assertive">
        <section className="runtime-fault__panel">
          <div className="runtime-fault__eyebrow">
            JØNEX // RUNTIME CONTAINMENT
          </div>
          <h1>Interface process interrupted</h1>
          <p>
            The shell contained a rendering failure instead of terminating the
            native operations process. The incident was written to the local
            diagnostic log.
          </p>

          <dl className="runtime-fault__details">
            <div>
              <dt>INCIDENT</dt>
              <dd>{incident.id}</dd>
            </div>
            <div>
              <dt>CLASS</dt>
              <dd>{incident.name}</dd>
            </div>
            <div>
              <dt>MESSAGE</dt>
              <dd>{incident.message}</dd>
            </div>
            <div>
              <dt>TIME</dt>
              <dd>{incident.occurredAt}</dd>
            </div>
          </dl>

          <div className="runtime-fault__actions">
            <button
              type="button"
              onClick={() => this.setState({ incident: null })}
            >
              Retry interface
            </button>
            <button
              type="button"
              className="runtime-fault__secondary"
              onClick={() => window.location.reload()}
            >
              Reload shell
            </button>
          </div>
        </section>
      </main>
    );
  }
}
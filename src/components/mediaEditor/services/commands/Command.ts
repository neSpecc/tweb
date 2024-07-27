export interface Command {
  execute(): void;
  undo(): void;
}

export class BatchCommand implements Command {
  private commands: Command[] = [];

  addCommand(command: Command) {
    this.commands.push(command);
  }

  execute() {
    this.commands.forEach(command => command.execute());
  }

  undo() {
    for(let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

import {BatchCommand, Command} from './commands/Command';

export default class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private currentBatch: BatchCommand | null = null;

  startBatch() {
    if(!this.currentBatch) {
      this.currentBatch = new BatchCommand();
    }
  }

  endBatch() {
    if(this.currentBatch) {
      this.undoStack.push(this.currentBatch);
      this.redoStack = [];
      this.currentBatch = null;
    }
  }

  executeCommand(command: Command) {
    command.execute();

    if(this.currentBatch) {
      this.currentBatch.addCommand(command);
    } else {
      this.undoStack.push(command);
      this.redoStack = [];
    }
  }

  undo() {
    const command = this.undoStack.pop();

    if(command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo() {
    const command = this.redoStack.pop();

    if(command) {
      command.execute();
      this.undoStack.push(command);
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}

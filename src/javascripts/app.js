import ko from 'knockout';
import * as bindings from './bindings';
import * as components from './components';
import registerComponent from './utils/register-component';

class App {

  constructor() {
    this.rootEl = null;
    this.config = {};

    this.isNavOpen = ko.observable().subscribeTo('navIsOpen', true);
  }

  setConfig() {
    if (arguments.length === 2) {
      this.config[arguments[0]] = arguments[1];
    }

    if (arguments.length === 1) {
      this.config = Object.assign(this.config, arguments[0]);
    }
  }

  clearConfig() {
    this.config = {};
  }

  addBindings() {
    for (const name in bindings) {
      ko.bindingHandlers[name] = bindings[name];
      if (bindings[name].allowVirtual) {
        ko.virtualElements.allowedBindings[name] = true;
      }
    }
  }

  addComponents() {
    for (const name in components) {
      registerComponent({
          ...components[name],
        name,
        app: this
    });
    }
  }

  start(rootEl = document.body) {
    this.rootEl = rootEl;

    this.addBindings();
    this.addComponents();

    ko.applyBindings(this, this.rootEl);
  }

  stop() {
    ko.cleanNode(this.rootEl);
  }
}

export default App;

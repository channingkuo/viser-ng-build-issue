import { sandboxOf } from 'angular-playground';
import { AppComponent } from './app.component';

export default sandboxOf(AppComponent)
  .add('playground', {
    template: `<app-root>Hey playground!</app-root>`
  });

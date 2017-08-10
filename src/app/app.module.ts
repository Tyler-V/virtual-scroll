import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { VirtualScrollComponent } from './virtual-scroll/virtual-scroll.component';

import * as $ from 'jquery';

@NgModule({
  declarations: [
    AppComponent,
    VirtualScrollComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

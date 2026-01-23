import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IndexedDBBridgeService } from './core/services/indexeddb-bridge.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private indexedDBBridge = inject(IndexedDBBridgeService);

  ngOnInit() {
    // IndexedDBBridgeService 会在构造函数中自动初始化监听器
  }
}

import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-history',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './history.html',
  styleUrl: './history.scss'
})
export class History {
  ngOnInit() {}
}

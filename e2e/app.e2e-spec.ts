import { VirtualScrollPage } from './app.po';

describe('virtual-scroll App', () => {
  let page: VirtualScrollPage;

  beforeEach(() => {
    page = new VirtualScrollPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!!');
  });
});

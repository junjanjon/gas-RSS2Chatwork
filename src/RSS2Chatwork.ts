import Utils from './Utils';

type FeedItem = {
  title: string;
  link: string;
  summary: string;
  time: Date;
};

export default class RSS2Chatwork {
  roomId: string;
  feedUrl: string;
  lastUpdateDate: Date;
  token: string;

  /**
   * constructor
   * @param roomId
   * @param feedUrl
   */
  constructor(roomId: string, feedUrl: string, lastUpdateDate: Date) {
    this.roomId = roomId;
    this.feedUrl = feedUrl;
    this.lastUpdateDate = lastUpdateDate;
    this.token = Utils.getChatworkToken();
  }
  /**
   * postMessage
   * @param feeds
   */
  public postMessage(feeds: FeedItem[]): Date {
    let updateDate: Date = this.lastUpdateDate;
    for (let feedItem of feeds) {
      let message;
      if (this.lastUpdateDate.getTime() > feedItem.time.getTime()) {
        continue;
      } else {
        let dateString: string = Utilities.formatDate(feedItem.time, 'JST', 'yyyy-MM-dd HH:mm:ss');
        message =
          '[info][title]' +
          feedItem.title +
          '\n[' +
          dateString +
          '][/title]' +
          feedItem.link +
          '[hr]' +
          feedItem.summary +
          '[/info]';
      }
      if (message == '') {
        continue;
      }
      let payload = {
        body: message
      };
      const options: Object = {
        method: 'post',
        headers: { 'X-ChatWorkToken': this.token },
        payload: payload
      };
      Utils.fetchAsJson('https://api.chatwork.com/v2/rooms/' + this.roomId + '/messages', options);
      if (!(updateDate.getTime() > feedItem.time.getTime())) {
        updateDate = feedItem.time;
      }
    }
    return updateDate;
  }
  /**
   * determineFeedType
   * @param document
   */
  private determineFeedType(document: GoogleAppsScript.XML_Service.Document): string {
    const atomNS = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    let entry = document.getRootElement().getChildren('entry', atomNS);
    if (entry && entry.length > 0) {
      return 'atom';
    }
    const rssNS = XmlService.getNamespace('http://purl.org/rss/1.0/');
    let item = document.getRootElement().getChildren('item', rssNS);
    if (item && item.length > 0) {
      return 'rss1';
    }
    let channel = document.getRootElement().getChild('channel');
    if (channel) {
      let item = channel.getChildren('item');
      if (item && item.length > 0) {
        return 'rss2';
      }
    }
    return 'other';
  }

  /**
   * parseFeed
   */
  public parseFeed(): FeedItem[] {
    const document = Utils.fetchAsXmlDocument(this.feedUrl);
    const feedType = this.determineFeedType(document);
    if (feedType == 'atom') {
      return this.parseAtom(document);
    } else if (feedType == 'rss1') {
      return this.parseRSS10(document);
    } else if (feedType == 'rss2') {
      return this.parseRSS20(document);
    } else {
      return new Array();
    }
  }

  private parseRSS10(document: GoogleAppsScript.XML_Service.Document) {
    let root = document.getRootElement();
    const rss = XmlService.getNamespace('http://purl.org/rss/1.0/');
    const dc = XmlService.getNamespace('dc', 'http://purl.org/dc/elements/1.1/');
    let items = root.getChildren('item', rss);
    let feedItems: FeedItem[] = new Array();

    for (let i in items) {
      let link = items[i].getChild('link', rss).getText();
      link = Utils.decodeURIComponentSafety(link);
      let description = items[i].getChild('description', rss);
      let item: FeedItem = {
        title: items[i].getChild('title', rss).getText(),
        link: link,
        summary: Utils.getTextOrBlank(description),
        time: new Date(items[i].getChild('date', dc).getText())
      };
      feedItems.push(item);
    }
    return feedItems;
  }

  private parseRSS20(document: GoogleAppsScript.XML_Service.Document) {
    let root = document.getRootElement();
    let items = root.getChild('channel').getChildren('item');
    let feedItems: FeedItem[] = new Array();
    for (let i in items) {
      let link = items[i].getChild('link').getText();
      link = Utils.decodeURIComponentSafety(link);
      let description = items[i].getChild('description');
      let item: FeedItem = {
        title: items[i].getChild('title').getText(),
        link: link,
        summary: Utils.getTextOrBlank(description),
        time: new Date(items[i].getChild('pubDate').getText())
      };
      feedItems.push(item);
    }
    return feedItems;
  }

  private parseAtom(document: GoogleAppsScript.XML_Service.Document) {
    const atomNS = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    const entry = document.getRootElement().getChildren('entry', atomNS);
    let items: FeedItem[] = new Array();
    for (let i in entry) {
      let link = entry[i]
        .getChild('link', atomNS)
        .getAttribute('href')
        .getValue();
      if (link.match(/&url=(.*)&ct=ga/)) {
        link = Utils.decodeURIComponentSafety(link.match(/&url=(.*)&ct=ga/)[0]);
      } else {
        link = Utils.decodeURIComponentSafety(link);
      }
      let updated = entry[i].getChild('updated', atomNS).getText();
      let time = Utils.toDate(updated);
      if (time.toString() === 'Invalid Date') {
        let pubDate = entry[i].getChild('pubDate', atomNS).getText();
        time = Utils.toDate(pubDate);
      }
      let item: FeedItem = {
        title: entry[i]
          .getChild('title', atomNS)
          .getText()
          .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, ''),
        link: link,
        summary: entry[i]
          .getChild('content', atomNS)
          .getText()
          .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '')
          .replace(/&nbsp;|&raquo;|and more/g, ' '),
        time: time
      };
      items.push(item);
    }
    return items;
  }
}
export { FeedItem };

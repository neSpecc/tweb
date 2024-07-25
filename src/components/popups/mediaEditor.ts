import PopupElement from '.';
import {type SendFileDetails} from '../../lib/appManagers/appMessagesManager';
import MediaEditor from '../mediaEditor';

export default class PopupMediaEditor extends PopupElement {
  constructor(params: {
    file: File,
    width: number,
    height: number,
  }
  ) {
    super(
      'popup-media-editor',
      {
        overlayClosable: true,
        onBackClick: () => {
          console.log('back click');
        },
        body: true
      }
    );

    this.body.append(MediaEditor(params, {
      middleware: this.middlewareHelper.get()
    }) as Node)
  }

  private onImageLoad(image: HTMLImageElement) {

  }
}

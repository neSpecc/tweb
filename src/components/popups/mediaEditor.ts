import PopupElement from '.';
import {type SendFileDetails} from '../../lib/appManagers/appMessagesManager';
import MediaEditor from '../mediaEditor';

export default class PopupMediaEditor extends PopupElement {
  constructor(params: {
    file: File,
    width: number,
    height: number,
    onSave: (file: File) => void
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

    const onClose = () => {
      this.hide();
    }

    const onSave = (file: File) => {
      this.hide();
      params.onSave(file);
    }

    this.body.append(MediaEditor({
      file: params.file,
      width: params.width,
      height: params.height,
      onClose,
      onSave
    }, {
      middleware: this.middlewareHelper.get()
    }) as Node)
  }

  private onImageLoad(image: HTMLImageElement) {

  }
}

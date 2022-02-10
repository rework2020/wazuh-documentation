/**
 * --------------------------------------------------------------------------
 * Wazuh documentation (v3.0): code-block.js
 * --------------------------------------------------------------------------
 */

if ( $('.document').length > 0 ) {
  /* Create element ".output-title" ----------------------------------------- */
  const outputTitleElement = document.createElement('div');
  outputTitleElement.setAttribute('class', 'output-title');
  outputTitleElement.setAttribute('role', 'button');
  outputTitleElement.innerHTML = 'Output';
  $('[class*="highlight-"].output').each(function() {
    $(this).addClass('collapsible').attr('aria-expanded', 'false');
    $(this).prepend(outputTitleElement.cloneNode(true));
  });

  /* Toggle collapse code-block, currently only for output code-blocks ----- */
  $('[class*="highlight-"].output.collapsible .output-title').on('click', function(e) {
    const codeBlock = $(e.target).closest('[class*="highlight-"]');
    if ( codeBlock.hasClass('collapsed') ) {
      codeBlock.removeClass('collapsed').attr('aria-expanded', 'true');
    } else {
      codeBlock.addClass('collapsed').attr('aria-expanded', 'false');
    }
  });

  /* Escaped tag signs ------------------------------------------------------ */
  $('.highlight').each(function() {
    const blockCode = $(this).parent();
    if (blockCode.hasClass('escaped-tag-signs')) {
      let data = $(this).html();
      const datafragments = data.split(/\\</);
      data = '';
      datafragments.forEach(function(ltFragment, i) {
        /* The first fragment occurs just before the opening tag, so it doesn't need to be processed */
        if (i != 0) {
          gtFragments = ltFragment.split(/&gt;/);
          ltFragment = gtFragments.shift();
          if (gtFragments.length) {
            ltFragment += '\\>' + gtFragments.join('>');
          }
        }
        if (i != datafragments.length - 1) {
          data += ltFragment + '\\<';
        } else {
          data += ltFragment;
        }
      });
      $(this).html(data);
    }
  });

  /* Avoid selecting $ and # present in the code blocks --------------------- */
  $('.highlight').each(function() {
    const blockCode = $(this);
    const data = blockCode.html();
    if (!blockCode.parent().hasClass('highlight-none')) {
      const heredocs = findHeredocs(data);
      const find = data.match(/(?:\$\s|\#)/g);
      if (find != null) {
        const dataArray = data.split('\n');
        const content = [];
        dataArray.forEach(function(line, i) {
          const heredocstart = heredocs.find( ({start}) => start === i );
          const heredocfinish = heredocs.find( ({finish}) => finish === i );
          const heredoc = heredocs.find( ({start, finish}) => start < i && finish > i );
          if ( heredocstart ) {
            line = '<span class="heredoc">'+line;
          } else if (heredocfinish) {
            line = line+'</span>';
          } else if (!heredoc) {
            line = line.replace('<span class="gp">#</span> ', '<span class="gp no-select"># </span>');
            line = line.replace('<span class="gp">$</span> ', '<span class="gp no-select">$ </span>');
            line = line.replace(/(?:\$\s)/g, '<span class="no-select">$ </span>');
          }
          content.push(line);
        });
        blockCode.html(content.join('\n'));
      }
    }
  });

  /* Adding button "Copy to clipboard" -------------------------------------- */
  $('.highlight').each(function() {
    const blockCode = $(this).parent();
    if (!blockCode.closest('[class*="highlight-"]').hasClass('output') && !blockCode.hasClass('no-copy')) {
      blockCode.prepend('<button type="button" class="copy-to-clipboard" title="Copy to clipboard"><span>Copied to clipboard</span><i class="far fa-copy" aria-hidden="true"></i></button>');
    }
  });

  /* Copy to clipboard functionality ---------------------------------------- */
  $('.copy-to-clipboard').click(function() {
    const copyButton = $(this);
    let data = $(copyButton).parent().find('.highlight');
    data = filterCodeBlock(data, $(copyButton).parent());
    copyToClipboard(data);
    $(copyButton).addClass('copied');
    $(copyButton).find('i').css({'display': 'none'}).find('span').css({'display': 'block'});
    $(copyButton).find('span').css({'display': 'block'});
    setTimeout(function() {
      $(copyButton).removeClass('copied');
    }, 700);
    setTimeout(function() {
      $(copyButton).find('span').css({'display': 'none'});
      $(copyButton).find('i').css({'display': 'block'});
      $(copyButton).focus();
    }, 1000);
  });

  /**
   * Filter the code block text that will be copied to the clipboard
   * @param {string} code The string from the code block
   * @param {Obj} parent jQuery object containing the parent element, which has the appropriate lexer class
   * @return {string} filter code block text
   */
  function filterCodeBlock(code, parent) {
    let data = code.text();
    const heredocs = findHeredocs(code);
    data = String(data);
    if ( !parent.hasClass('highlight-none') ) {
      /* Remove elipsis */
      data = data.replace(/(^|\n)\s*(\.\s{0,1}){3}\s*($|\n)/g, '\n');
      /* Remove prompts with square brakets */
      data = data.replace(/(.+]\$\s)/g, '');
      data = data.replace(/(.+]\#\s)/g, '');
      /* Remove especific prompts */
      data = data.replace(/ansible@ansible:.+\$\s/g, '');
      data = data.replace(/mysql>\s/g, '');
      data = data.replace(/sqlite>\s/g, '');
      data = data.replace(/Query\s.+\)\n/g, '');
      /* Remove prompts with format user@domain in general */
      data = data.replace(/.+@.+:.+(\#|\$)\s/g, '');
      /* Remove prompts with the symbol > */
      data = data.replace(/^>\s/g, '');
      data = data.replace(/\n>\s/g, '\n');
      /* Remove prompts with the symbol $ */
      data = data.replace(/(?:\$\s)/g, '');
      /* Remove additional line breaks */
      data = data.replace(/\n{2,}$/g, '\n');
      /* Remove prompts with the symbol # only when they cannot be considered comments */
      if (!parent.hasClass('highlight-yaml')
        && !parent.hasClass('highlight-python')
        && !parent.hasClass('highlight-perl')
        && !parent.hasClass('highlight-powershell')
        && !parent.is($('[class*="conf"]'))) {
        const isBash = parent.hasClass('highlight-bash');
        const isConsole = parent.hasClass('highlight-console');
        if (/<<[^<]/.test(data)) {
          data = replacePromptOnHeredoc(data, heredocs, isConsole, isBash);
        } else {
          data = filterPrompt(data, isConsole, isBash);
        }
      }
    }
    data = data.trim();
    return data;
  }

  /**
   * Looks for heredocs within a code-block
   * @param {string} code The HTML code that must be checked
   * @return {array} list o all the heredocs found in the code-block, described by their start and finish lines
   */
  function findHeredocs(code) {
    const lines = $(code).text().split('\n');
    const heredocs = [];
    let inHereDoc = false;
    let limitString;
    let start;
    let finish;

    lines.forEach((line, i) => {
      /* If we're inside a heredoc, look for the closing limit string */
      if (inHereDoc) {
        if (closes(limitString, line.trim())) {
          inHereDoc = false;
          finish = i-1;
          /* If the heredoc is empty, we don't add it to the list */
          if (finish > start) {
            heredocs.push({start: start, finish: finish});
          }
        }
      } else if (/<<[^<]/.test(line)) {
        /* Check if the current command starts a heredoc */
        inHereDoc = true;
        start = i+1;
        limitString = line.split('<<')[1].trim();
      }
    });

    return heredocs;
  }

  /**
   * Filters some of the prompt lines within a code-block depending on the type
   * @param {string} data The text of the code-block that must be filtered
   * @param {boolean} isConsole True if the type of the code-block is 'console'
   * @param {boolean} isBash True if the type of the code-block is 'bash'
   * @return {string} The text of the code-block already filtered
   */
  function filterPrompt(data, isConsole = false, isBash = false) {
    if (!isBash) {
      /* Remove prompts with the symbol # only when they cannot be considered comments */
      data = data.replace(/(?:\#\s)/g, '');
    }
    if (isConsole || isBash) {
      /* Remove comment lines (starging with //) */
      data = data.replace(/(^|\n)\/\/.+/g, '');
      /* Remove additional line breaks in command lines to avoid accidental enter inputs */
      data = data.replace(/\n{2,}/g, '\n');
    }
    return data;
  }

  /**
   * Uses the information on heredocs in order to avoid parsing heredoc content
   * @param {string} code The text of the code-block that must be filtered
   * @param {array} heredocs Information on the heredocs found in this particular code-block
   * @param {boolean} isConsole True if the type of the code-block is 'console'
   * @param {boolean} isBash True if the type of the code-block is 'bash'
   * @return {string} The text of the code-block already filtered buet with the heredocs still intact
   */
  function replacePromptOnHeredoc(code, heredocs, isConsole = false, isBash = false) {
    const parsed = [];
    const lines = code.split('\n');
    lines.forEach(function(line, i) {
      const heredoc = heredocs.find( ({start, finish}) => start <= i && finish >= i );
      if ( !heredoc ) {
        line = filterPrompt(line, isConsole, isBash);
      }
      parsed.push(line);
    });

    return parsed.join('\n');
  }

  /**
   * Given a word (open) and a delimiter (close), this functions checks if they match
   * @param {string} open The term used as word after de operator `<<`
   * @param {string} close the term used as delimiter
   * @return {boolean} true if they match, false if they don't
   */
  function closes(open, close) {
    return close.replace(/[-\\'"]/g, '') == open.replace(/[-\\'"]/g, '');
  }

  /**
   * Copy the data to clipboard
   * @param {string} data The string to copy
   */
  function copyToClipboard(data) {
    const aux = document.createElement('textarea');
    aux.value = data;
    document.body.appendChild(aux);
    aux.select();
    document.execCommand('copy');
    document.body.removeChild(aux);
  }
}
